/**
 * Centralized status change handler.
 * Called by BOTH PUT /api/clients/[id] AND POST /api/telepros/action.
 * Handles: score recalculation, CAPI events, freeze, Telegram, WhatsApp.
 *
 * All DB writes are batched into a single prisma.client.update() to avoid race conditions.
 */
import prisma from "./prisma";
import { calculateLeadScore } from "./lead-scoring";
import {
  FREEZE_STATUSES, TERMINAL_STATUSES,
  SIGNE_VARIANTS, POSE_VARIANTS, PAYE_VARIANTS,
} from "./constants";
import {
  trackQualifiedOwner,
  trackDisqualifiedLead,
  trackScheduleWithScore,
  trackPurchaseWithScore,
  trackInstallationWithScore,
} from "./facebook-conversions-api";
import { notifyRDVPris, notifySignature } from "./telegram-notifications";
import { sendWhatsAppText } from "./whatsapp";
import type { Client } from "@prisma/client";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StatusChangeOpts {
  clientId: number;
  before: Client;
  after: Client;
  user: { id: number; name: string };
}

interface StatusChangeResult {
  pixelEvents: string[];
  newScore: number;
}

// ─── Freeze helper (call BEFORE saving) ──────────────────────────────────────

export function computeFreezeUpdate(
  newStatusCall: string | undefined,
  currentClient: { statusCall: string | null; frozen: boolean },
): Record<string, any> {
  if (!newStatusCall || newStatusCall === currentClient.statusCall) return {};
  if (FREEZE_STATUSES.includes(newStatusCall) && !currentClient.frozen) {
    return { frozen: true, frozenAt: new Date() };
  }
  if (TERMINAL_STATUSES.includes(newStatusCall) && currentClient.frozen) {
    return { frozen: false, frozenAt: null };
  }
  return {};
}

// ─── Main handler (call AFTER saving) ────────────────────────────────────────

export async function processStatusChange(opts: StatusChangeOpts): Promise<StatusChangeResult> {
  const { clientId, before, after } = opts;
  const pixelEvents: string[] = [];
  const dbPatch: Record<string, any> = {}; // Single batch DB update

  const statusCallChanged = after.statusCall !== before.statusCall;
  const statusRDVChanged = after.statusRDV !== before.statusRDV;

  // ── 1. Recalculate score ─────────────────────────────────────────────────
  const score = calculateLeadScore(after);
  if (score.total !== after.leadScore || score.priority !== after.leadPriority) {
    dbPatch.leadScore = score.total;
    dbPatch.leadPriority = score.priority;
    dbPatch.leadScoreDetails = JSON.stringify(score.details);
    dbPatch.leadScoreUpdatedAt = new Date();
    console.log(`[Score] Client ${clientId}: ${score.total}/100 (${score.priority})`);
  }

  // ── 2. CAPI QualifiedOwner ───────────────────────────────────────────────
  if (after.isOwner === "Oui" && score.total >= 40 && !after.pixelQualifiedSent) {
    try {
      await trackQualifiedOwner(buildCAPIPayload(after), score.total);
      dbPatch.pixelQualifiedSent = true;
      dbPatch.qualifiedAt = new Date();
      console.log(`[CAPI] QualifiedOwner → client ${clientId} (score: ${score.total})`);
    } catch (e) {
      console.error(`[CAPI] QualifiedOwner failed → client ${clientId}:`, e);
    }
  }

  // ── 3. CAPI DisqualifiedLead ─────────────────────────────────────────────
  if (after.isOwner === "Non" && !after.pixelDisqualifiedSent) {
    try {
      await trackDisqualifiedLead(buildCAPIPayload(after), "Non");
      dbPatch.pixelDisqualifiedSent = true;
      dbPatch.disqualifiedAt = new Date();
      console.log(`[CAPI] DisqualifiedLead → client ${clientId}`);
    } catch (e) {
      console.error(`[CAPI] DisqualifiedLead failed → client ${clientId}:`, e);
    }
  }

  // ── 4. statusCall → RDV PRIS ─────────────────────────────────────────────
  if (statusCallChanged && after.statusCall === "RDV PRIS" && !before.pixelRDVSent) {
    pixelEvents.push("rdv_pris");
    dbPatch.pixelRDVSent = true;

    // Telegram (fire & forget)
    try { await notifyRDVPris(clientId); } catch (e) { console.error("[Telegram] RDV PRIS failed:", e); }

    // WhatsApp confirmation
    if (after.mobile) {
      try {
        const rdvDate = after.rdvDate
          ? new Date(after.rdvDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
          : "à confirmer";
        const rdvHeure = after.rdvTime ? ` à ${after.rdvTime}` : "";
        const waMsg = `Bonjour ${after.firstName} 👋\n\nVotre rendez-vous pour l'étude de votre projet panneaux solaires est confirmé ✅\n\n📅 ${rdvDate}${rdvHeure}\n\nNous vous contacterons à cette date. En cas d'empêchement répondez à ce message.\n\nÉnergie Solaire France 🌞`;
        await sendWhatsAppText(after.mobile, waMsg);
      } catch (e) {
        console.error("[WhatsApp] RDV confirm failed:", e);
      }
    }

    // CAPI Schedule
    if (score.total > 0) {
      try {
        await trackScheduleWithScore(buildCAPIPayload(after), score.total);
        console.log(`[CAPI] Schedule → client ${clientId} (score: ${score.total})`);
      } catch (e) {
        console.error("[CAPI] Schedule failed:", e);
      }
    }
  }

  // ── 5. statusCall → HORS ZONE ────────────────────────────────────────────
  if (statusCallChanged && after.statusCall === "HORS ZONE") {
    dbPatch.archived = true;
    dbPatch.archivedAt = new Date();
    dbPatch.archiveReason = "HORS_ZONE";
    dbPatch.disqualifiedAt = new Date();
    dbPatch.disqualificationReason = "HORS_ZONE";
    dbPatch.leadScore = Math.min(score.total, 10);
    dbPatch.pixelDisqualifiedSent = true;
    console.log(`[HORS ZONE] Client ${clientId} archivé`);
  }

  // ── 6-8. statusRDV changes ───────────────────────────────────────────────
  if (statusRDVChanged && after.statusRDV) {
    const s = after.statusRDV.toUpperCase();

    // SIGNÉ* → Purchase CAPI
    if (SIGNE_VARIANTS.includes(s) && !before.pixelSignatureSent) {
      pixelEvents.push("signature");
      dbPatch.pixelSignatureSent = true;

      try { await notifySignature(clientId); } catch (e) { console.error("[Telegram] Signature failed:", e); }

      if (score.total > 0) {
        try {
          const amount = after.totalAmount ? parseFloat(after.totalAmount as string) : undefined;
          await trackPurchaseWithScore(buildCAPIPayload(after), score.total, amount);
          console.log(`[CAPI] Purchase → client ${clientId} (score: ${score.total})`);
        } catch (e) {
          console.error("[CAPI] Purchase failed:", e);
        }
      }
    }

    // POSÉ* → Installation CAPI
    if (POSE_VARIANTS.includes(s) && !before.pixelInstallSent) {
      pixelEvents.push("installation");
      dbPatch.pixelInstallSent = true;

      if (score.total > 0) {
        try {
          const amount = after.totalAmount ? parseFloat(after.totalAmount as string) : undefined;
          await trackInstallationWithScore(buildCAPIPayload(after), score.total, amount);
          console.log(`[CAPI] Installation → client ${clientId} (score: ${score.total})`);
        } catch (e) {
          console.error("[CAPI] Installation failed:", e);
        }
      }
    }

    // PAYÉ → Payment pixel
    if (PAYE_VARIANTS.includes(s) && !before.pixelPaymentSent) {
      pixelEvents.push("paiement");
      dbPatch.pixelPaymentSent = true;
    }
  }

  // ── Single batched DB write ──────────────────────────────────────────────
  if (Object.keys(dbPatch).length > 0) {
    await prisma.client.update({ where: { id: clientId }, data: dbPatch });
  }

  return { pixelEvents, newScore: score.total };
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function buildCAPIPayload(client: Client) {
  return {
    id: client.id,
    email: client.email || undefined,
    mobile: client.mobile || undefined,
    firstName: client.firstName || undefined,
    lastName: client.lastName || undefined,
    city: client.city || undefined,
    zipCode: client.zipCode || undefined,
    fbLeadId: client.fbLeadId || undefined,
    fbCampaignId: client.fbCampaignId || undefined,
    fbAdSetId: client.fbAdSetId || undefined,
    fbAdId: client.fbAdId || undefined,
    fbFormId: client.fbFormId || undefined,
  };
}
