import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { FacebookAdsService } from "@/lib/facebook-ads";

/**
 * API Route: GET /api/facebook/live-stats
 *
 * Récupère les statistiques en temps réel pour le monitoring Facebook Lead Ads
 *
 * Données retournées:
 * - KPIs du jour (dépenses, leads, CPL moyen)
 * - Comparaison avec hier
 * - Performance par campagne
 * - Évolution horaire
 * - 10 derniers leads
 */
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { error: "Non autorisé - Admin uniquement" },
        { status: 403 }
      );
    }

    // Dates pour aujourd'hui et hier
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayEnd);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

    // Format dates pour Facebook API (YYYY-MM-DD)
    const todayStr = todayStart.toISOString().split("T")[0];
    const yesterdayStr = yesterdayStart.toISOString().split("T")[0];

    // Récupérer les dépenses depuis Facebook Marketing API
    const fbAdsService = new FacebookAdsService();

    // Insights aujourd'hui
    const todayInsights = await fbAdsService.getAllCampaignsInsights({
      since: todayStr,
      until: todayStr,
    });

    // Insights hier
    const yesterdayInsights = await fbAdsService.getAllCampaignsInsights({
      since: yesterdayStr,
      until: yesterdayStr,
    });

    // Calculer les dépenses totales
    const totalSpendToday = todayInsights.reduce((sum, i) => sum + parseFloat(String(i.spend || 0)), 0);
    const spendYesterday = yesterdayInsights.reduce((sum, i) => sum + parseFloat(String(i.spend || 0)), 0);

    // Récupérer les leads créés aujourd'hui dans le CRM
    const leadsToday = await prisma.client.findMany({
      where: {
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
        fbCampaignId: { not: null }, // Uniquement les leads Facebook
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        mobile: true,
        createdAt: true,
        fbCampaignId: true,
        fbCampaignName: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Récupérer les leads d'hier
    const leadsYesterday = await prisma.client.count({
      where: {
        createdAt: {
          gte: yesterdayStart,
          lte: yesterdayEnd,
        },
        fbCampaignId: { not: null },
      },
    });

    // KPIs globaux
    const totalLeadsToday = leadsToday.length;
    const avgCPLToday = totalLeadsToday > 0 ? totalSpendToday / totalLeadsToday : 0;
    const cplYesterday = leadsYesterday > 0 ? spendYesterday / leadsYesterday : 0;

    // Performance par campagne
    const campaignGroups = new Map<string, typeof leadsToday>();
    leadsToday.forEach((lead) => {
      const campaignId = lead.fbCampaignId!;
      if (!campaignGroups.has(campaignId)) {
        campaignGroups.set(campaignId, []);
      }
      campaignGroups.get(campaignId)!.push(lead);
    });

    // Récupérer les campagnes actives
    const campaigns = await fbAdsService.getCampaigns("ACTIVE");
    const allCampaigns = await fbAdsService.getCampaigns(); // Toutes pour avoir les en pause aussi

    const campaignsStats = Array.from(campaignGroups.entries()).map(
      ([campaignId, leads]) => {
        const campaignInsight = todayInsights.find((i) => i.campaign_id === campaignId);
        const campaignInfo = allCampaigns.find((c) => c.id === campaignId);

        const spendToday = parseFloat(String(campaignInsight?.spend || 0));
        const leadsCount = leads.length;
        const cplToday = leadsCount > 0 ? spendToday / leadsCount : 0;

        return {
          campaignId,
          campaignName: leads[0]?.fbCampaignName || campaignId,
          spendToday,
          leadsToday: leadsCount,
          cplToday,
          status: campaignInfo?.status || "ACTIVE",
        };
      }
    );

    // Ajouter les campagnes actives sans leads aujourd'hui
    todayInsights.forEach((insight) => {
      if (!campaignGroups.has(insight.campaign_id)) {
        const campaignInfo = allCampaigns.find((c) => c.id === insight.campaign_id);
        if (campaignInfo && campaignInfo.status === "ACTIVE") {
          campaignsStats.push({
            campaignId: insight.campaign_id,
            campaignName: insight.campaign_name || insight.campaign_id,
            spendToday: parseFloat(String(insight.spend || 0)),
            leadsToday: 0,
            cplToday: 0,
            status: "ACTIVE",
          });
        }
      }
    });

    // Trier par CPL croissant (les plus élevés en premier pour alertes)
    campaignsStats.sort((a, b) => {
      // Campagnes avec leads d'abord
      if (a.leadsToday > 0 && b.leadsToday === 0) return -1;
      if (a.leadsToday === 0 && b.leadsToday > 0) return 1;
      // Puis par CPL décroissant
      return b.cplToday - a.cplToday;
    });

    // Évolution horaire (simplifiée - regrouper par heures complètes)
    const hourlyData: Array<{ hour: string; spend: number; leads: number; cpl: number }> = [];

    // Grouper les leads par heure
    const leadsByHour = new Map<number, number>();
    leadsToday.forEach((lead) => {
      const hour = new Date(lead.createdAt).getHours();
      leadsByHour.set(hour, (leadsByHour.get(hour) || 0) + 1);
    });

    // Pour les dépenses par heure, on approxime en divisant uniformément
    // (Facebook API ne fournit pas les dépenses horaires directement)
    const currentHour = now.getHours();
    const hoursElapsed = currentHour + 1; // +1 car on inclut l'heure actuelle
    const avgSpendPerHour = hoursElapsed > 0 ? totalSpendToday / hoursElapsed : 0;

    for (let h = 0; h <= currentHour; h++) {
      const leads = leadsByHour.get(h) || 0;
      const spend = avgSpendPerHour; // Approximation
      const cpl = leads > 0 ? spend / leads : 0;

      hourlyData.push({
        hour: h.toString().padStart(2, "0"),
        spend,
        leads,
        cpl,
      });
    }

    // 10 derniers leads avec infos complètes
    const recentLeads = leadsToday.slice(0, 10).map((lead) => ({
      id: lead.id,
      firstName: lead.firstName || "",
      lastName: lead.lastName || "",
      mobile: lead.mobile || "",
      createdAt: lead.createdAt.toISOString(),
      campaign: lead.fbCampaignName || lead.fbCampaignId || "",
    }));

    return NextResponse.json({
      // KPIs du jour
      totalSpendToday,
      totalLeadsToday,
      avgCPLToday,

      // Comparaison avec hier
      spendYesterday,
      leadsYesterday,
      cplYesterday,

      // Données par campagne
      campaigns: campaignsStats,

      // Évolution horaire
      hourlyData,

      // 10 derniers leads
      recentLeads,

      // Dernière mise à jour
      lastUpdate: now.toISOString(),
    });
  } catch (error: any) {
    console.error("Erreur API live-stats:", error);
    return NextResponse.json(
      {
        error: "Erreur serveur",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
