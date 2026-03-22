import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import type { Prisma } from "@prisma/client";
import { scoreBatchLeads } from "@/lib/lead-scoring";

/**
 * POST /api/clients/recalculate-scores
 * Recalcule les scores de tous les leads (ou filtrés)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Vérifier permissions (admin uniquement)
    if (user.role !== "admin" && user.role !== "manager") {
      return NextResponse.json(
        { error: "Permissions insuffisantes" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { onlyWithoutScore, archived } = body;

    // Construire la query
    const where: Prisma.ClientWhereInput = {};

    if (onlyWithoutScore) {
      where.leadScore = null;
    }

    if (archived !== undefined) {
      where.archived = archived;
    }

    // Récupérer tous les clients
    console.log(`📊 Récupération des clients...`);
    const clients = await prisma.client.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        firstName: true,
        lastName: true,
        email: true,
        mobile: true,
        phone1: true,
        city: true,
        zipCode: true,
        address: true,
        campaign: true,
        fbLeadId: true,
        totalAmount: true,
        electricBill: true,
        isOwner: true,
        householdIncome: true,
        ownerSince: true,
        surface: true,
        pool: true,
        electricCar: true,
        roofOrientation: true,
        roofSpace: true,
        zoneABF: true,
        rdvDate: true,
        statusRDV: true,
        statusCall: true,
        observation: true,
        infosRDV: true,
        archived: true,
      },
    });

    console.log(`📊 ${clients.length} clients à scorer...`);

    // Calculer scores en batch
    const scores = scoreBatchLeads(clients);

    // Préparer les updates
    const updates: Array<{ where: { id: number }; data: Prisma.ClientUpdateInput }> = [];
    for (const [clientId, score] of scores) {
      updates.push({
        where: { id: clientId },
        data: {
          leadScore: score.total,
          leadPriority: score.priority,
          leadScoreDetails: JSON.stringify(score.details),
          leadScoreUpdatedAt: new Date(),
        },
      });
    }

    // Exécuter les updates en parallèle (batch)
    console.log(`💾 Sauvegarde des scores...`);
    const updatePromises = updates.map((update) =>
      prisma.client.update(update)
    );

    await Promise.all(updatePromises);

    // Statistiques
    const stats = {
      total: clients.length,
      tresHaute: 0,
      haute: 0,
      moyenne: 0,
      basse: 0,
    };

    for (const [, score] of scores) {
      if (score.priority === "TRÈS HAUTE") stats.tresHaute++;
      else if (score.priority === "HAUTE") stats.haute++;
      else if (score.priority === "MOYENNE") stats.moyenne++;
      else stats.basse++;
    }

    console.log(`✅ Scores recalculés avec succès`);

    return NextResponse.json({
      success: true,
      message: `${clients.length} scores recalculés`,
      stats,
    });
  } catch (error: unknown) {
    console.error("❌ Erreur recalcul scores:", error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    return NextResponse.json(
      { error: "Erreur serveur", details: errorMessage },
      { status: 500 }
    );
  }
}
