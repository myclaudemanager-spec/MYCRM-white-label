import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { FacebookAdsService } from "@/lib/facebook-ads";

/**
 * API Route: POST /api/facebook-ads/sync-retroactive
 *
 * Associe rétroactivement les clients existants aux campagnes Facebook
 * en utilisant le champ "campaign" pour matcher avec les noms de campagnes Facebook
 *
 * Exemple:
 * - Client avec campaign = "mondomaine.com"
 * - Campagne Facebook "Leads PV 2026 - PACA"
 * → Match si le nom contient "paca" ou "leads"
 */

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { error: "Non autorisé - Admin uniquement" },
        { status: 403 }
      );
    }

    // Récupérer toutes les campagnes Facebook
    const fbAdsService = new FacebookAdsService();
    const campaigns = await fbAdsService.getCampaigns();

    // Créer un map : nom campagne → campaign ID
    const campaignMap = new Map<string, { id: string; name: string }>();
    campaigns.forEach((campaign) => {
      campaignMap.set(campaign.id, { id: campaign.id, name: campaign.name });
    });

    // Récupérer tous les clients qui n'ont PAS encore d'attribution Facebook
    // mais qui ont un champ "campaign" rempli
    const clientsToUpdate = await prisma.client.findMany({
      where: {
        AND: [
          { campaign: { not: null } },
          { campaign: { not: "" } },
          { fbCampaignId: null },
        ],
      },
      select: {
        id: true,
        campaign: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });

    if (clientsToUpdate.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Aucun client à mettre à jour",
        updated: 0,
      });
    }

    // Pour chaque client, essayer de trouver une campagne Facebook correspondante
    let updatedCount = 0;
    const updates: Array<{ clientId: number; campaignId: string; campaignName: string }> = [];

    for (const client of clientsToUpdate) {
      const campaignField = (client.campaign || "").toLowerCase();

      // Essayer de matcher avec les noms de campagnes Facebook
      let matchedCampaign: { id: string; name: string } | null = null;

      for (const [campaignId, campaign] of campaignMap.entries()) {
        const campaignName = campaign.name.toLowerCase();

        // Stratégies de matching
        const keywords = extractKeywords(campaignField);
        const matchScore = calculateMatchScore(keywords, campaignName);

        // Si score > 0.5, on considère que c'est un match
        if (matchScore > 0.5) {
          matchedCampaign = campaign;
          break;
        }
      }

      // Si on a trouvé une correspondance, mettre à jour le client
      if (matchedCampaign) {
        updates.push({
          clientId: client.id,
          campaignId: matchedCampaign.id,
          campaignName: matchedCampaign.name,
        });
      }
    }

    // Appliquer les mises à jour en batch
    for (const update of updates) {
      await prisma.client.update({
        where: { id: update.clientId },
        data: {
          fbCampaignId: update.campaignId,
          fbCampaignName: update.campaignName,
          fbSyncedAt: new Date(),
        },
      });

      // Log action
      await prisma.action.create({
        data: {
          clientId: update.clientId,
          type: "Attribution FB rétroactive",
          detail: `Associé à la campagne "${update.campaignName}" (${update.campaignId})`,
        },
      });

      updatedCount++;
    }

    return NextResponse.json({
      success: true,
      message: `${updatedCount} client(s) associé(s) rétroactivement`,
      updated: updatedCount,
      details: updates.map((u) => ({
        clientId: u.clientId,
        campaignName: u.campaignName,
      })),
    });
  } catch (error: any) {
    console.error("Erreur sync rétroactive:", error);
    return NextResponse.json(
      {
        error: "Erreur serveur",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * Extraire les mots-clés d'un champ campaign
 * Ex: "mondomaine.com" → ["mondomaine"]
 */
function extractKeywords(campaign: string): string[] {
  return campaign
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ") // Remplacer symboles par espaces
    .split(/\s+/)
    .filter((word) => word.length > 2); // Mots de 3+ caractères
}

/**
 * Calculer un score de matching entre keywords et nom de campagne
 * Retourne un score entre 0 et 1
 */
function calculateMatchScore(keywords: string[], campaignName: string): number {
  if (keywords.length === 0) return 0;

  let matchCount = 0;

  for (const keyword of keywords) {
    if (campaignName.includes(keyword)) {
      matchCount++;
    }
  }

  // Score = ratio de keywords matchés
  return matchCount / keywords.length;
}
