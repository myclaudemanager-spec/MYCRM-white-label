import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { addHistoryEntry, createCallHistoryEntry } from "@/lib/history";

// Tranches horaires pour l'analyse NRP
const TIME_SLOTS = [
  { label: "8h-10h", start: 8, end: 10 },
  { label: "10h-12h", start: 10, end: 12 },
  { label: "12h-14h", start: 12, end: 14 },
  { label: "14h-16h", start: 14, end: 16 },
  { label: "16h-18h", start: 16, end: 18 },
  { label: "18h-20h", start: 18, end: 20 },
];

function getTimeSlot(callTime: string): string {
  const hour = parseInt(callTime.split(":")[0], 10);
  const slot = TIME_SLOTS.find((s) => hour >= s.start && hour < s.end);
  return slot ? slot.label : "Autre";
}

function analyzeNRPPatterns(
  callLogs: { result: string; callTime: string }[],
  currentSlot: string
): string | null {
  // Compter les NRP par tranche horaire
  const nrpBySlot: Record<string, number> = {};
  for (const log of callLogs) {
    if (log.result === "NRP") {
      const slot = getTimeSlot(log.callTime);
      nrpBySlot[slot] = (nrpBySlot[slot] || 0) + 1;
    }
  }

  // Si 3+ NRP dans la tranche actuelle, suggérer une autre
  if ((nrpBySlot[currentSlot] || 0) >= 3) {
    // Trouver la tranche avec le moins de NRP
    const bestSlot = TIME_SLOTS.reduce(
      (best, slot) => {
        const count = nrpBySlot[slot.label] || 0;
        if (slot.label !== currentSlot && count < best.count) {
          return { label: slot.label, count };
        }
        return best;
      },
      { label: "", count: Infinity }
    );

    if (bestSlot.label) {
      return `Ce client a été NRP ${nrpBySlot[currentSlot]} fois entre ${currentSlot}. Essayez entre ${bestSlot.label}.`;
    }
  }

  return null;
}

// GET — Historique des appels d'un client
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    if (!clientId) {
      return NextResponse.json({ error: "clientId requis" }, { status: 400 });
    }

    const callLogs = await prisma.callLog.findMany({
      where: { clientId: parseInt(clientId) },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    // Analyse NRP pour suggestion
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    const currentSlot = getTimeSlot(currentTime);
    const suggestion = analyzeNRPPatterns(callLogs, currentSlot);

    return NextResponse.json({ callLogs, suggestion });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST — Enregistrer un appel
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await req.json();
    const { clientId, result, comment, callTime } = body;

    if (!clientId || !result || !callTime) {
      return NextResponse.json(
        { error: "clientId, result et callTime requis" },
        { status: 400 }
      );
    }

    // Valider que le commentaire est obligatoire si conversation (pas NRP)
    if (result !== "NRP" && result !== "FAUX_NUMERO" && (!comment || !comment.trim())) {
      return NextResponse.json(
        { error: "Commentaire obligatoire pour ce type de résultat" },
        { status: 400 }
      );
    }

    // 1. Créer le CallLog
    const callLog = await prisma.callLog.create({
      data: {
        clientId: parseInt(clientId),
        userId: user.id,
        result,
        comment: comment?.trim() || null,
        callTime,
      },
    });

    // 2. Récupérer le client pour mettre à jour callHistory
    const client = await prisma.client.findUnique({
      where: { id: parseInt(clientId) },
      select: { callHistory: true },
    });

    // 3. Mettre à jour le statut du client
    const updateData: Record<string, unknown> = {};

    // Ajouter à callHistory (historique JSON)
    const historyEntry = createCallHistoryEntry(
      user.name,
      result,
      comment?.trim(),
      callTime
    );
    updateData.callHistory = addHistoryEntry(client?.callHistory || null, historyEntry);

    // Map result to statusCall
    const statusMap: Record<string, string> = {
      NRP: "NRP",
      A_RAPPELER: "A RAPPELER",
      "RDV_CONFIRMÉ": "RDV CONFIRMÉ",
      RDV_PRIS: "RDV PRIS",
      PAS_INTERESSE: "PAS INTERESSE",
      FAUX_NUMERO: "FAUX NUMERO",
    };

    if (statusMap[result]) {
      updateData.statusCall = statusMap[result];
    }

    // 4. Incrémenter missedCalls si NRP
    if (result === "NRP") {
      updateData.missedCalls = { increment: 1 };
    }

    // Always update lastCommentText for performance (denormalized)
    if (comment?.trim()) {
      updateData.lastCommentText = comment.trim();
      updateData.lastCommentAt = new Date();
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.client.update({
        where: { id: parseInt(clientId) },
        data: updateData,
      });
    }

    // 5. Créer une Action de suivi
    await prisma.action.create({
      data: {
        type: "appel",
        detail: `Appel: ${result}${comment ? ` — ${comment.substring(0, 100)}` : ""}`,
        newStatus: statusMap[result] || result,
        userId: user.id,
        clientId: parseInt(clientId),
      },
    });

    // 6. Analyser les patterns NRP pour ce client
    const allLogs = await prisma.callLog.findMany({
      where: { clientId: parseInt(clientId) },
      select: { result: true, callTime: true },
    });

    const currentSlot = getTimeSlot(callTime);
    const suggestion = analyzeNRPPatterns(allLogs, currentSlot);

    return NextResponse.json({ callLog, suggestion });
  } catch (err) {
    console.error("Erreur call-log:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
