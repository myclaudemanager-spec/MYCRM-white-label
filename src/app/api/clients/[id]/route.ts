import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { decryptClient } from "@/lib/encryption";
import { addHistoryEntry, createStatusHistoryEntry } from "@/lib/history";
import { buildUpdateData } from "@/lib/normalize-client";
import { computeFreezeUpdate, processStatusChange } from "@/lib/status-change-handler";

// ─── Allowed fields for client update ────────────────────────────────────────

const ALLOWED_FIELDS = [
  "civilite", "firstName", "lastName", "address", "zipCode", "city",
  "mobile", "phone1", "phone2", "email", "observation",
  "statusCall", "statusRDV", "team", "campaign",
  "rdvDate", "rdvTime", "vtDate", "vtTime", "rappelDate", "rappelTime",
  "rdvCreatedDate", "confirmedWith", "rapportCommerciale", "infosRDV",
  "typeRDV", "rdvDuration",
  "ownerSince", "propertyType", "surface", "counter", "heatingSystem",
  "pool", "electricCar", "electricBill", "roofOrientation", "roofSpace",
  "zoneABF", "familyStatus", "ageMr", "ageMme", "situationMr", "situationMme",
  "children", "householdIncome", "currentCredit", "financing", "isOwner",
  "societe", "bank", "power", "totalAmount", "cessionPrice", "oversell",
  "cqYoran", "installDate",
  "invoiceHT", "invoiceTTC", "commissionHT", "commissionTTC",
  "deductionType", "annexFees", "commissionTelepos", "commissionFinal", "marginBH",
  "autoConsumption", "tvaRecovery", "primeRenov", "cee",
  "observationCommercial", "fbAttribution",
];

// ─── GET /api/clients/[id] ───────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id: parseInt(id) },
    include: {
      commercial1: { select: { id: true, name: true } },
      commercial2: { select: { id: true, name: true } },
      telepos: { select: { id: true, name: true } },
      actions: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { name: true } } },
      },
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Client non trouvé" }, { status: 404 });
  }

  return NextResponse.json({ client: decryptClient(client) });
}

// ─── PUT /api/clients/[id] ───────────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const clientId = parseInt(id);

  try {
    const body = await request.json();

    const currentClient = await prisma.client.findUnique({ where: { id: clientId } });
    if (!currentClient) {
      return NextResponse.json({ error: "Client non trouvé" }, { status: 404 });
    }

    // ── Build update data (type casting + isOwner normalization) ────────────
    const updateData: any = buildUpdateData(body, ALLOWED_FIELDS);

    // Relation fields (not in ALLOWED_FIELDS)
    if (body.commercial1Id !== undefined) updateData.commercial1Id = body.commercial1Id ? parseInt(body.commercial1Id) : null;
    if (body.commercial2Id !== undefined) updateData.commercial2Id = body.commercial2Id ? parseInt(body.commercial2Id) : null;
    if (body.teleposId !== undefined) updateData.teleposId = body.teleposId ? parseInt(body.teleposId) : null;

    // ── Auto-freeze / unfreeze ─────────────────────────────────────────────
    Object.assign(updateData, computeFreezeUpdate(body.statusCall, currentClient));

    // Manual freeze toggle (admin only)
    if (body.frozen !== undefined && user.role === "admin") {
      updateData.frozen = body.frozen;
      updateData.frozenAt = body.frozen ? new Date() : null;
    }

    // ── Save to DB ─────────────────────────────────────────────────────────
    const client = await prisma.client.update({ where: { id: clientId }, data: updateData });

    // ── Status history tracking ────────────────────────────────────────────
    const statusCallChanged = body.statusCall && body.statusCall !== currentClient.statusCall;
    const statusRDVChanged = body.statusRDV && body.statusRDV !== currentClient.statusRDV;

    if (statusCallChanged) {
      await prisma.action.create({
        data: {
          type: "changement_statut",
          detail: "Statut call changé",
          oldStatus: currentClient.statusCall || "",
          newStatus: body.statusCall,
          userId: user.id,
          clientId,
        },
      });
      const entry = createStatusHistoryEntry(user.name, "Call", currentClient.statusCall, body.statusCall);
      await prisma.client.update({
        where: { id: clientId },
        data: { statusHistory: addHistoryEntry(currentClient.statusHistory || null, entry) },
      });
    }

    if (statusRDVChanged) {
      await prisma.action.create({
        data: {
          type: "changement_statut",
          detail: "Statut RDV changé",
          oldStatus: currentClient.statusRDV || "",
          newStatus: body.statusRDV,
          userId: user.id,
          clientId,
        },
      });
      const entry = createStatusHistoryEntry(user.name, "RDV", currentClient.statusRDV, body.statusRDV);
      await prisma.client.update({
        where: { id: clientId },
        data: { statusHistory: addHistoryEntry(currentClient.statusHistory || null, entry) },
      });
    }

    // ── Telepos assignment notification ────────────────────────────────────
    if (body.teleposId !== undefined && parseInt(body.teleposId) !== currentClient.teleposId && body.teleposId) {
      await prisma.notification.create({
        data: {
          userId: parseInt(body.teleposId),
          type: "assigned",
          title: `Client assigné: ${(client.lastName || "")} ${(client.firstName || "")}`.trim(),
          message: `Le client ${client.firstName || ""} ${client.lastName || ""} vous a été assigné.`,
          clientId,
        },
      });
    }

    // Log modification
    await prisma.action.create({
      data: {
        type: "modification",
        detail: `Client modifié: ${client.firstName} ${client.lastName}`,
        userId: user.id,
        clientId,
      },
    });

    // ── Process all side effects (score, CAPI, Telegram, WhatsApp) ────────
    const { pixelEvents } = await processStatusChange({
      clientId,
      before: currentClient,
      after: client,
      user: { id: user.id, name: user.name },
    });

    return NextResponse.json({ client: decryptClient(client), pixelEvents });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Update client error:", errMsg, error);
    return NextResponse.json({ error: `Erreur lors de la mise à jour: ${errMsg}` }, { status: 500 });
  }
}

// ─── DELETE /api/clients/[id] ────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }

  const { id } = await params;
  const clientId = parseInt(id);

  try {
    const client = await prisma.client.update({
      where: { id: clientId },
      data: { deletedAt: new Date() },
    });

    await prisma.action.create({
      data: {
        type: "suppression",
        detail: `Client supprimé (soft delete) par ${user.name}`,
        userId: user.id,
        clientId,
      },
    });

    return NextResponse.json({ success: true, client });
  } catch (error) {
    console.error("Delete client error:", error);
    return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 });
  }
}
