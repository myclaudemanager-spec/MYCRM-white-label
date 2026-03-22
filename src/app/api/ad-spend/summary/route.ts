/**
 * API Route : /api/ad-spend/summary
 *
 * Récupère un résumé des dépenses publicitaires
 *
 * Query params :
 * - platform : 'facebook' | 'google' | 'all'
 * - period : 'today' | 'yesterday' | 'last_7d' | 'last_30d' | 'this_month' | 'last_month' | 'custom'
 * - since : YYYY-MM-DD (si custom)
 * - until : YYYY-MM-DD (si custom)
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { convertCurrency } from '@/lib/currency-service';

const prisma = new PrismaClient();

// ==================== HELPERS ====================

/**
 * Calculer plage de dates selon période
 */
function getDateRange(period: string, since?: string, until?: string): { start: Date; end: Date } {
  const now = new Date();
  let start: Date;
  let end: Date = now;

  switch (period) {
    case 'today':
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
      break;

    case 'yesterday':
      start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setHours(23, 59, 59, 999);
      break;

    case 'last_7d':
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      break;

    case 'last_30d':
      start = new Date(now);
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      break;

    case 'this_month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;

    case 'last_month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;

    case 'custom':
      if (!since || !until) {
        throw new Error('Custom period requires "since" and "until" parameters');
      }
      start = new Date(since);
      start.setHours(0, 0, 0, 0);
      end = new Date(until);
      end.setHours(23, 59, 59, 999);
      break;

    default:
      // Défaut : 30 derniers jours
      start = new Date(now);
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
  }

  return { start, end };
}

// ==================== HANDLER GET ====================

export async function GET(request: NextRequest) {
  try {
    // Récupérer params
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform') || 'all';
    const period = searchParams.get('period') || 'last_30d';
    const since = searchParams.get('since') || undefined;
    const until = searchParams.get('until') || undefined;

    // Calculer plage de dates
    const { start, end } = getDateRange(period, since, until);

    // Construire WHERE clause
    const where: any = {
      date: {
        gte: start,
        lte: end,
      },
    };

    if (platform !== 'all') {
      where.platform = platform;
    }

    // Récupérer toutes les dépenses de la période
    const adSpends = await prisma.adSpend.findMany({
      where,
      orderBy: {
        date: 'asc',
      },
    });

    // Calculer résumé global
    const summary = {
      totalSpend: 0,
      totalSpendEUR: 0,
      currency: 'AED',
      totalImpressions: 0,
      totalClicks: 0,
      totalLeads: 0,
      avgCPL: 0,
      avgCPC: 0,
      avgCTR: 0,
    };

    adSpends.forEach((spend: any) => {
      summary.totalSpend += spend.spend;
      summary.totalSpendEUR += spend.spendEUR;
      summary.totalImpressions += spend.impressions;
      summary.totalClicks += spend.clicks;
      summary.totalLeads += spend.leads;
    });

    // Calculer moyennes
    summary.avgCPL = summary.totalLeads > 0 ? summary.totalSpend / summary.totalLeads : 0;
    summary.avgCPC = summary.totalClicks > 0 ? summary.totalSpend / summary.totalClicks : 0;
    summary.avgCTR =
      summary.totalImpressions > 0 ? (summary.totalClicks / summary.totalImpressions) * 100 : 0;

    // Grouper par plateforme
    const byPlatform: Record<string, any> = {};

    adSpends.forEach((spend: any) => {
      if (!byPlatform[spend.platform]) {
        byPlatform[spend.platform] = {
          spend: 0,
          spendEUR: 0,
          leads: 0,
          clicks: 0,
          impressions: 0,
        };
      }

      byPlatform[spend.platform].spend += spend.spend;
      byPlatform[spend.platform].spendEUR += spend.spendEUR;
      byPlatform[spend.platform].leads += spend.leads;
      byPlatform[spend.platform].clicks += spend.clicks;
      byPlatform[spend.platform].impressions += spend.impressions;
    });

    // Calculer CPL par plateforme
    Object.keys(byPlatform).forEach((platform) => {
      const p = byPlatform[platform];
      p.cpl = p.leads > 0 ? p.spend / p.leads : 0;
      p.cpc = p.clicks > 0 ? p.spend / p.clicks : 0;
    });

    // Grouper par campagne
    const campaignMap: Record<string, any> = {};

    adSpends.forEach((spend: any) => {
      if (!campaignMap[spend.campaignId]) {
        campaignMap[spend.campaignId] = {
          campaignId: spend.campaignId,
          campaignName: spend.campaignName,
          platform: spend.platform,
          spend: 0,
          spendEUR: 0,
          leads: 0,
          clicks: 0,
          impressions: 0,
          objective: spend.objective,
          status: spend.status,
        };
      }

      const c = campaignMap[spend.campaignId];
      c.spend += spend.spend;
      c.spendEUR += spend.spendEUR;
      c.leads += spend.leads;
      c.clicks += spend.clicks;
      c.impressions += spend.impressions;
    });

    // Calculer CPL par campagne
    const byCampaign = Object.values(campaignMap).map((c: any) => ({
      ...c,
      cpl: c.leads > 0 ? c.spend / c.leads : 0,
      cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
    }));

    // Créer évolution quotidienne
    const evolutionMap: Record<string, any> = {};

    adSpends.forEach((spend: any) => {
      const dateKey = spend.date.toISOString().split('T')[0];

      if (!evolutionMap[dateKey]) {
        evolutionMap[dateKey] = {
          date: dateKey,
          spend: 0,
          spendEUR: 0,
          leads: 0,
          clicks: 0,
          impressions: 0,
        };
      }

      const e = evolutionMap[dateKey];
      e.spend += spend.spend;
      e.spendEUR += spend.spendEUR;
      e.leads += spend.leads;
      e.clicks += spend.clicks;
      e.impressions += spend.impressions;
    });

    // Convertir en tableau et trier par date
    const evolution = Object.values(evolutionMap).sort((a: any, b: any) =>
      a.date.localeCompare(b.date)
    );

    // Réponse
    return NextResponse.json({
      success: true,
      summary,
      byPlatform,
      byCampaign,
      evolution,
      period: {
        type: period,
        start: start.toISOString(),
        end: end.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Erreur /api/ad-spend/summary:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
