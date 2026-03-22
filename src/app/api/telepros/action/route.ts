import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { addHistoryEntry, createCallHistoryEntry } from "@/lib/history";
import { computeFreezeUpdate, processStatusChange } from "@/lib/status-change-handler";

const STATUS_MAP: Record<string, string> = {
  NRP: "NRP",
  A_RAPPELER: "A RAPPELER",
  RDV_PRIS: "RDV PRIS",
  PAS_INTERESSE: "PAS INTERESSE",
  FAUX_NUMERO: "FAUX NUM",
};

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await req.json();
    const { clientId, result, callTime, cardShownAt, rdvDate, rdvTime, comment, rappelDate, rappelTime } = body;

    if (!clientId || !result || !callTime) {
      return NextResponse.json({ error: "clientId, result et callTime requis" }, { status: 400 });
    }

    // ── Get current client state (before update) ───────────────────────────
    const currentClient = await prisma.client.findUnique({ where: { id: clientId } });
    if (!currentClient) {
      return NextResponse.json({ error: "Client non trouvé" }, { status: 404 });
    }

    // ── Create call log ────────────────────────────────────────────────────
    const elapsed = cardShownAt ? Date.now() - new Date(cardShownAt).getTime() : Infinity;
    const isCombo = elapsed < 30_000;

    await prisma.callLog.create({
      data: { clientId, userId: user.id, result, callTime, comment: comment || null },
    });

    // ── Build update data ──────────────────────────────────────────────────
    const newStatus = STATUS_MAP[result];
    const historyEntry = createCallHistoryEntry(user.name, result, undefined, callTime);
    const updateData: Record<string, unknown> = {
      callHistory: addHistoryEntry(currentClient.callHistory || null, historyEntry),
    };

    if (newStatus) updateData.statusCall = newStatus;
    if (result === "NRP") updateData.missedCalls = { increment: 1 };

    if (comment) {
      updateData.lastCommentText = comment;
      updateData.lastCommentAt = new Date();
    }

    if (result === "RDV_PRIS") {
      if (rdvDate) updateData.rdvDate = rdvDate;
      if (rdvTime) updateData.rdvTime = rdvTime;
      updateData.rdvCreatedDate = new Date();
    }

    if (result === "A_RAPPELER" && rappelDate) {
      updateData.rappelDate = new Date(rappelDate);
      if (rappelTime) updateData.rappelTime = rappelTime;
    }

    // ── Auto-freeze / unfreeze (centralized) ───────────────────────────────
    if (newStatus) {
      Object.assign(updateData, computeFreezeUpdate(newStatus, currentClient));
    }

    // ── Save to DB ─────────────────────────────────────────────────────────
    const updatedClient = await prisma.client.update({ where: { id: clientId }, data: updateData });

    // ── Process all side effects (score, CAPI, Telegram, WhatsApp) ────────
    await processStatusChange({
      clientId,
      before: currentClient,
      after: updatedClient,
      user: { id: user.id, name: user.name },
    });

    // ── Gamification ───────────────────────────────────────────────────────
    const pointsToAdd = isCombo ? 2 : 1;
    const existing = await prisma.userPoints.findUnique({ where: { userId: user.id } });

    let updatedPoints: { points: number; combos: number };
    if (existing) {
      updatedPoints = await prisma.userPoints.update({
        where: { userId: user.id },
        data: {
          points: { increment: pointsToAdd },
          combos: isCombo ? { increment: 1 } : undefined,
          callsToday: { increment: 1 },
          lastCallAt: new Date(),
        },
      });
    } else {
      updatedPoints = await prisma.userPoints.create({
        data: {
          userId: user.id,
          points: pointsToAdd,
          combos: isCombo ? 1 : 0,
          callsToday: 1,
          lastCallAt: new Date(),
        },
      });
    }

    const nextTotal = await prisma.client.count({
      where: {
        archived: false,
        deletedAt: null,
        OR: [
          { teleposId: user.id, statusCall: { in: ["NEW", "A RAPPELER"] } },
          { statusCall: "NRP" },
        ],
      },
    });

    return NextResponse.json({
      success: true,
      points: updatedPoints.points,
      combos: updatedPoints.combos,
      isCombo,
      nextTotal,
    });
  } catch (err) {
    console.error("telepros/action:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
