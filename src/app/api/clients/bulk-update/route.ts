import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { calculateLeadScore } from "@/lib/lead-scoring";

/**
 * POST /api/clients/bulk-update
 * Mise à jour en masse de clients sélectionnés
 * Body: { ids: number[], updates: { statusCall?, statusRDV?, isOwner? } }
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const { ids, updates } = await request.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Aucun client sélectionné" }, { status: 400 });
    }
    if (!updates || Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Aucune modification spécifiée" }, { status: 400 });
    }

    // Limiter les champs modifiables en bulk
    const ALLOWED_BULK_FIELDS = ["statusCall", "statusRDV", "isOwner", "campaign", "team", "teleposId"];
    const cleanUpdates: Record<string, string> = {};
    for (const key of Object.keys(updates)) {
      if (ALLOWED_BULK_FIELDS.includes(key) && updates[key] !== undefined && updates[key] !== "") {
        cleanUpdates[key] = updates[key];
      }
    }

    if (Object.keys(cleanUpdates).length === 0) {
      return NextResponse.json({ error: "Aucun champ valide à modifier" }, { status: 400 });
    }

    // teleposId doit etre un int
    if (cleanUpdates.teleposId) {
      (cleanUpdates as any).teleposId = parseInt(cleanUpdates.teleposId);
    }

    // Normaliser isOwner (sécurité : convertit toute valeur legacy vers Oui/Non)
    if (cleanUpdates.isOwner === "Proprietaire" || cleanUpdates.isOwner === "Propriétaire") {
      cleanUpdates.isOwner = "Oui";
    } else if (
      cleanUpdates.isOwner === "Non éligible" ||
      cleanUpdates.isOwner === "Locataire" ||
      cleanUpdates.isOwner === "Appartement" ||
      cleanUpdates.isOwner === "Autre"
    ) {
      cleanUpdates.isOwner = "Non";
    }

    // Appliquer la mise à jour
    const result = await prisma.client.updateMany({
      where: { id: { in: ids } },
      data: cleanUpdates,
    });

    // Recalculer les scores pour tous les clients modifiés
    const clients = await prisma.client.findMany({
      where: { id: { in: ids } },
    });

    let scoreUpdated = 0;
    for (const client of clients) {
      const score = calculateLeadScore(client);
      await prisma.client.update({
        where: { id: client.id },
        data: {
          leadScore: score.total,
          leadPriority: score.priority,
          leadScoreDetails: JSON.stringify(score.details),
          leadScoreUpdatedAt: new Date(),
        },
      });
      scoreUpdated++;
    }

    // Log l'action
    await prisma.action.create({
      data: {
        type: "modification",
        detail: `Modification en masse: ${result.count} clients — ${Object.entries(cleanUpdates).map(([k, v]) => `${k}=${v}`).join(", ")}`,
        userId: user.id,
      },
    });

    console.log(`[BulkUpdate] ${result.count} clients mis à jour par ${user.name}: ${JSON.stringify(cleanUpdates)}`);

    return NextResponse.json({
      success: true,
      updated: result.count,
      scoresRecalculated: scoreUpdated,
      changes: cleanUpdates,
    });
  } catch (error) {
    console.error("Bulk update error:", error);
    return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 });
  }
}
