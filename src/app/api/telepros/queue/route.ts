import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const LEAD_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  mobile: true,
  phone1: true,
  city: true,
  zipCode: true,
  statusCall: true,
  missedCalls: true,
  rappelDate: true,
  rappelTime: true,
  leadScore: true,
  leadPriority: true,
  lastCommentText: true,
  lastCommentAt: true,
  observation: true,
} as const;

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Leads personnels = assignés à ce télépros
    const personalFilter = { teleposId: user.id };

    const [rappelsTodayRaw, newLeads, recallLeads, nrpLeads] = await Promise.all([
      // Priorité 0 : Rappels du jour (personnels, statuts actifs uniquement)
      prisma.client.findMany({
        where: {
          ...personalFilter,
          rappelDate: { gte: todayStart, lte: todayEnd },
          statusCall: { in: ["NEW", "NRP", "A RAPPELER"] },
          archived: false,
          deletedAt: null,
        },
        orderBy: { rappelTime: "asc" },
        take: 10,
        select: LEAD_SELECT,
      }),
      // Priorité 1 : Nouveaux leads (personnels)
      prisma.client.findMany({
        where: { ...personalFilter, statusCall: "NEW", archived: false, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: LEAD_SELECT,
      }),
      // Priorité 2 : À rappeler (personnels)
      prisma.client.findMany({
        where: { ...personalFilter, statusCall: "A RAPPELER", archived: false, deletedAt: null },
        orderBy: [{ rappelDate: "asc" }, { missedCalls: "asc" }],
        take: 10,
        select: LEAD_SELECT,
      }),
      // Priorité 3 : NRP — pool partagé (tous télépros, pas de filtre user)
      prisma.client.findMany({
        where: { statusCall: "NRP", archived: false, deletedAt: null },
        orderBy: [{ missedCalls: "asc" }, { rappelDate: "asc" }],
        take: 10,
        select: LEAD_SELECT,
      }),
    ]);

    // Dédoublonnage : éviter qu'un lead rappel du jour apparaisse aussi en A RAPPELER
    const rappelIds = new Set(rappelsTodayRaw.map((l) => l.id));
    const newFiltered = newLeads.filter((l) => !rappelIds.has(l.id));
    const recallFiltered = recallLeads.filter((l) => !rappelIds.has(l.id));
    const nrpFiltered = nrpLeads.filter((l) => !rappelIds.has(l.id));

    const leads = [...rappelsTodayRaw, ...newFiltered, ...recallFiltered, ...nrpFiltered].slice(0, 20);

    // Total = leads personnels actifs + pool NRP partagé (sans doublons)
    const [personalCount, nrpCount] = await Promise.all([
      prisma.client.count({
        where: {
          ...personalFilter,
          statusCall: { in: ["NEW", "A RAPPELER"] },
          archived: false,
          deletedAt: null,
        },
      }),
      prisma.client.count({
        where: { statusCall: "NRP", archived: false, deletedAt: null },
      }),
    ]);

    // Rappels du jour hors NEW/A RAPPELER/NRP (pour ne pas double-compter avec nrpCount)
    const rappelTodayExtra = await prisma.client.count({
      where: {
        ...personalFilter,
        rappelDate: { gte: todayStart, lte: todayEnd },
        statusCall: { notIn: ["NEW", "A RAPPELER", "NRP"] },
        archived: false,
        deletedAt: null,
      },
    });

    const total = personalCount + nrpCount + rappelTodayExtra;

    return NextResponse.json({ leads, total });
  } catch (err) {
    console.error("telepros/queue:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
