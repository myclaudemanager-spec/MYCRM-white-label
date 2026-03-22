import { NextRequest, NextResponse } from 'next/server';
import { fbAdsService } from '@/lib/facebook-ads';
import { getCurrentUser } from '@/lib/auth';

/**
 * API Route: GET /api/facebook-ads/campaigns
 *
 * Récupère toutes les campagnes Facebook avec leurs insights
 *
 * Query params:
 * - status: ACTIVE | PAUSED (optionnel)
 * - period: last_7d | last_30d | last_90d (défaut: last_30d)
 */
export async function GET(request: NextRequest) {
  try {
    // Vérifier authentification (admin uniquement)
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'ACTIVE' | 'PAUSED' | undefined;
    const period = searchParams.get('period') || 'last_30d';

    // Récupérer les campagnes
    const campaigns = await fbAdsService.getCampaigns(status);

    // Récupérer tous les insights en une seule requête
    const dateRange = getDateRange(period);
    const allInsights = await fbAdsService.getAllCampaignsInsights(dateRange);

    // Combiner campagnes et insights
    const campaignsWithInsights = campaigns.map((campaign) => {
      const insights = allInsights.find((i) => i.campaign_id === campaign.id);

      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        created_time: campaign.created_time,
        updated_time: campaign.updated_time,
        insights: insights
          ? {
              spend: parseFloat(String(insights.spend || 0)),
              impressions: parseInt(String(insights.impressions || 0)),
              clicks: parseInt(String(insights.clicks || 0)),
              ctr: parseFloat(String(insights.ctr || 0)),
              cpc: parseFloat(String(insights.cpc || 0)),
              cpm: parseFloat(String(insights.cpm || 0)),
              leads: fbAdsService.getLeadsCount(insights),
              cost_per_lead: fbAdsService.getCostPerLead(insights),
            }
          : null,
      };
    });

    // Calculer les totaux
    const totals = campaignsWithInsights.reduce(
      (acc, c) => {
        if (c.insights) {
          acc.spend += c.insights.spend;
          acc.impressions += c.insights.impressions;
          acc.clicks += c.insights.clicks;
          acc.leads += c.insights.leads;
        }
        return acc;
      },
      { spend: 0, impressions: 0, clicks: 0, leads: 0 }
    );

    const averageCTR =
      totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const averageCPC = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
    const averageCPL = totals.leads > 0 ? totals.spend / totals.leads : 0;

    return NextResponse.json({
      success: true,
      period,
      campaigns: campaignsWithInsights,
      totals: {
        spend: totals.spend,
        impressions: totals.impressions,
        clicks: totals.clicks,
        leads: totals.leads,
        ctr: averageCTR,
        cpc: averageCPC,
        cpl: averageCPL,
      },
    });
  } catch (error: any) {
    console.error('Erreur API Facebook Campaigns:', error);
    return NextResponse.json(
      {
        error: 'Erreur serveur',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * Convertir période en date range
 */
function getDateRange(period: string): { since: string; until: string } | undefined {
  const now = new Date();
  const until = now.toISOString().split('T')[0];

  let since: Date;
  switch (period) {
    case 'last_7d':
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'last_30d':
      since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'last_90d':
      since = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      return undefined;
  }

  return {
    since: since.toISOString().split('T')[0],
    until,
  };
}
