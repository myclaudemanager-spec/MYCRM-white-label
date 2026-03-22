import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { FacebookAdsService } from "@/lib/facebook-ads";

const AED_TO_EUR = 0.25;
const EUR_TO_AED = 4;

/**
 * API Route: GET /api/facebook-ads/roi
 *
 * Calcule le ROI des campagnes Facebook Ads
 * - Dépenses pub (AED) depuis Facebook Marketing API
 * - Revenus (EUR) depuis les signatures clients dans le CRM
 * - Conversions à chaque étape : Leads → RDV → Signatures
 */

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { error: "Non autorisé - Admin uniquement" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "30d";

    // Calculer la date de début selon la période
    let sinceDate: Date | undefined;
    const now = new Date();

    switch (period) {
      case "7d":
        sinceDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        sinceDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        sinceDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "all":
        sinceDate = undefined;
        break;
      default:
        sinceDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Récupérer les dépenses depuis Facebook Marketing API
    const fbAdsService = new FacebookAdsService();

    // Note: Pour "all", on utilise les 90 derniers jours car Facebook Insights
    // ne permet pas de récupérer les données lifetime avec time_range
    const dateRange = sinceDate
      ? {
          since: sinceDate.toISOString().split("T")[0],
          until: now.toISOString().split("T")[0],
        }
      : undefined;

    const allInsights = await fbAdsService.getAllCampaignsInsights(dateRange);

    // Créer un map des dépenses par campagne (campaign ID → spend AED)
    const spendByCampaignId = new Map<string, number>();
    allInsights.forEach((insight) => {
      spendByCampaignId.set(insight.campaign_id, parseFloat(String(insight.spend || 0)));
    });

    // Récupérer tous les clients avec attribution Facebook
    const whereClause: any = {
      fbCampaignId: { not: null },
    };

    if (sinceDate) {
      whereClause.createdAt = { gte: sinceDate };
    }

    const clients = await prisma.client.findMany({
      where: whereClause,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        fbCampaignId: true,
        fbCampaignName: true,
        statusCall: true,
        statusRDV: true,
        invoiceTTC: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Grouper les clients par campagne
    const campaignGroups = new Map<string, typeof clients>();

    clients.forEach((client) => {
      const campaignId = client.fbCampaignId!;
      if (!campaignGroups.has(campaignId)) {
        campaignGroups.set(campaignId, []);
      }
      campaignGroups.get(campaignId)!.push(client);
    });

    // Calculer le ROI pour chaque campagne
    const campaigns = Array.from(campaignGroups.entries()).map(([campaignId, clients]) => {
      const campaignName = clients[0]?.fbCampaignName || campaignId;
      const totalSpend = spendByCampaignId.get(campaignId) || 0; // AED
      const totalSpendEUR = totalSpend * AED_TO_EUR;

      const leadsCount = clients.length;

      // RDV = clients qui ont un RDV (statusRDV != null et != "")
      const rdvCount = clients.filter(
        (c) =>
          c.statusRDV &&
          c.statusRDV !== "" &&
          c.statusRDV !== "RDV NON QUALIFIE"
      ).length;

      // Signatures = clients avec statusRDV contenant "SIGNE" ou "POSE"
      const signaturesCount = clients.filter(
        (c) =>
          c.statusRDV &&
          (c.statusRDV.includes("SIGNE") ||
            c.statusRDV.includes("POSE") ||
            c.statusRDV.includes("INSTALLE"))
      ).length;

      // CA total = somme des invoiceTTC des signatures
      const totalRevenue = clients
        .filter(
          (c) =>
            c.statusRDV &&
            (c.statusRDV.includes("SIGNE") ||
              c.statusRDV.includes("POSE") ||
              c.statusRDV.includes("INSTALLE"))
        )
        .reduce((sum, c) => sum + (c.invoiceTTC || 0), 0);

      const totalRevenueAED = totalRevenue * EUR_TO_AED;

      // ROI = (Revenus - Coûts) / Coûts × 100
      const roi =
        totalSpendEUR > 0
          ? ((totalRevenue - totalSpendEUR) / totalSpendEUR) * 100
          : 0;

      // Coût par étape
      const costPerLead = leadsCount > 0 ? totalSpend / leadsCount : 0;
      const costPerRDV = rdvCount > 0 ? totalSpend / rdvCount : 0;
      const costPerSignature = signaturesCount > 0 ? totalSpend / signaturesCount : 0;

      // Taux de conversion
      const conversionLeadToRDV = leadsCount > 0 ? (rdvCount / leadsCount) * 100 : 0;
      const conversionRDVToSignature = rdvCount > 0 ? (signaturesCount / rdvCount) * 100 : 0;
      const conversionLeadToSignature = leadsCount > 0 ? (signaturesCount / leadsCount) * 100 : 0;

      return {
        campaignId,
        campaignName,
        totalSpend,
        totalSpendEUR,
        leadsCount,
        rdvCount,
        signaturesCount,
        totalRevenue,
        totalRevenueAED,
        roi,
        costPerLead,
        costPerRDV,
        costPerSignature,
        conversionLeadToRDV,
        conversionRDVToSignature,
        conversionLeadToSignature,
      };
    });

    // Trier par ROI décroissant
    campaigns.sort((a, b) => b.roi - a.roi);

    // Calculer les totaux
    const totalSpend = campaigns.reduce((sum, c) => sum + c.totalSpend, 0);
    const totalSpendEUR = campaigns.reduce((sum, c) => sum + c.totalSpendEUR, 0);
    const totalLeads = campaigns.reduce((sum, c) => sum + c.leadsCount, 0);
    const totalRDV = campaigns.reduce((sum, c) => sum + c.rdvCount, 0);
    const totalSignatures = campaigns.reduce((sum, c) => sum + c.signaturesCount, 0);
    const totalRevenue = campaigns.reduce((sum, c) => sum + c.totalRevenue, 0);
    const totalRevenueAED = campaigns.reduce((sum, c) => sum + c.totalRevenueAED, 0);

    // ROI moyen pondéré
    const averageROI =
      totalSpendEUR > 0
        ? ((totalRevenue - totalSpendEUR) / totalSpendEUR) * 100
        : 0;

    return NextResponse.json({
      totalSpend,
      totalSpendEUR,
      totalLeads,
      totalRDV,
      totalSignatures,
      totalRevenue,
      totalRevenueAED,
      averageROI,
      campaigns,
      period,
    });
  } catch (error: any) {
    console.error("Erreur calcul ROI:", error);
    return NextResponse.json(
      {
        error: "Erreur serveur",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
