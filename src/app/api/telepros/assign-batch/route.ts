import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/telepros/assign-batch — Compter les leads non assignés
 * POST /api/telepros/assign-batch — Assigner les leads non assignés en round-robin
 */


export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const unassignedCount = await prisma.client.count({
    where: {
      teleposId: null,
      statusCall: { in: ["NEW", "A RAPPELER"] },
      deletedAt: null,
      archived: false,
    },
  });

  const teleprosCount = await prisma.user.count({ where: { role: "telepos", active: true } });

  return NextResponse.json({ unassignedCount, teleprosCount });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const unassigned = await prisma.client.findMany({
    where: {
      teleposId: null,
      statusCall: { in: ["NEW", "A RAPPELER"] },
      deletedAt: null,
      archived: false,
    },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { createdAt: "asc" },
  });

  if (unassigned.length === 0) {
    return NextResponse.json({ assigned: 0, message: "Aucun lead non assigné." });
  }

  // Charger tous les télépros actifs
  const telepros = await prisma.user.findMany({
    where: { role: "telepos", active: true },
    select: { id: true },
  });

  if (telepros.length === 0) {
    return NextResponse.json({ error: "Aucun télépros actif trouvé." }, { status: 400 });
  }

  // Compter les leads actifs par télépros pour démarrer le round-robin équitable
  const countsArr = await Promise.all(
    telepros.map(async (tp) => ({
      id: tp.id,
      count: await prisma.client.count({
        where: {
          teleposId: tp.id,
          statusCall: { in: ["NEW", "NRP", "A RAPPELER"] },
          deletedAt: null,
        },
      }),
    }))
  );
  countsArr.sort((a, b) => a.count - b.count);

  let assigned = 0;
  // Load-balancing équitable : toujours assigner au moins chargé (re-tri après chaque attribution)
  for (let i = 0; i < unassigned.length; i++) {
    countsArr.sort((a, b) => a.count - b.count);
    const tp = countsArr[0];
    await prisma.client.update({
      where: { id: unassigned[i].id },
      data: { teleposId: tp.id },
    });
    await prisma.notification.create({
      data: {
        userId: tp.id,
        type: "new_lead",
        title: `Lead assigné: ${(unassigned[i].lastName || "")} ${(unassigned[i].firstName || "")}`.trim(),
        message: "Un lead vous a été assigné par l'administrateur.",
        clientId: unassigned[i].id,
      },
    });
    tp.count++;
    assigned++;
  }

  return NextResponse.json({ assigned, message: `${assigned} lead(s) assigné(s) avec succès.` });
}
