import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { FacebookAdsService } from '@/lib/facebook-ads';
import prisma from '@/lib/prisma';

const AED_TO_EUR = 0.25;

// Google Ads known spend (API token expired, manually tracked)
// Source: Google Ads dashboard 8 dec 2025 - 27 feb 2026
const GOOGLE_ADS_TOTAL_SPEND_AED = 4991;
const GOOGLE_ADS_TOTAL_CONVERSIONS = 4;

/**
 * API Route: GET /api/analytics/combined-stats
 * Dashboard unifie Facebook Ads + Google Ads
 * Affiche: aujourd'hui + totaux lifetime
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Non autorise' }, { status: 403 });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const todayStr = todayStart.toISOString().split('T')[0];

    const fbService = new FacebookAdsService();

    // ===== FACEBOOK: TODAY =====
    let fbTodaySpend = 0;
    let fbTodayLeadsApi = 0;
    try {
      const fbTodayInsights = await fbService.getAllCampaignsInsights({
        since: todayStr,
        until: todayStr,
      });
      fbTodaySpend = fbTodayInsights.reduce((sum, i) => sum + parseFloat(String(i.spend || 0)), 0);
      // Extract lead count from actions
      for (const insight of fbTodayInsights) {
        for (const action of (insight.actions || [])) {
          if (action.action_type === 'lead') {
            fbTodayLeadsApi += parseInt(String(action.value || 0));
          }
        }
      }
    } catch (e) {
      console.error('FB today insights error:', e);
    }

    // ===== FACEBOOK: LIFETIME (since 2026-01-08) =====
    let fbLifetimeSpend = 0;
    let fbLifetimeLeadsApi = 0;
    try {
      const fbLifetimeInsights = await fbService.getAllCampaignsInsights({
        since: '2026-01-08',
        until: todayStr,
      });
      fbLifetimeSpend = fbLifetimeInsights.reduce((sum, i) => sum + parseFloat(String(i.spend || 0)), 0);
      for (const insight of fbLifetimeInsights) {
        for (const action of (insight.actions || [])) {
          if (action.action_type === 'lead') {
            fbLifetimeLeadsApi += parseInt(String(action.value || 0));
          }
        }
      }
    } catch (e) {
      console.error('FB lifetime insights error:', e);
    }

    // CRM lead counts
    const fbLeadsToday = await prisma.client.count({
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
        fbCampaignId: { not: null },
      },
    });

    const fbLeadsTotal = await prisma.client.count({
      where: { fbCampaignId: { not: null } },
    });

    // Google leads from CRM (landing page)
    const googleLeadsToday = await prisma.client.count({
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
        campaign: process.env.LANDING_DOMAIN?.replace(/^https?:\/\//, "") || "landing-page",
      },
    });

    const googleLeadsTotal = await prisma.client.count({
      where: { campaign: process.env.LANDING_DOMAIN?.replace(/^https?:\/\//, "") || "landing-page" },
    });

    // Active campaigns
    let fbActiveCampaigns = 0;
    try {
      const campaigns = await fbService.getCampaigns('ACTIVE');
      fbActiveCampaigns = campaigns.length;
    } catch (e) {}

    // ===== BUILD RESPONSE =====
    const fbTodayCpl = fbLeadsToday > 0 ? fbTodaySpend / fbLeadsToday : 0;
    const fbLifetimeCpl = fbLifetimeLeadsApi > 0 ? fbLifetimeSpend / fbLifetimeLeadsApi : 0;
    const googleLifetimeCpl = GOOGLE_ADS_TOTAL_CONVERSIONS > 0 ? GOOGLE_ADS_TOTAL_SPEND_AED / GOOGLE_ADS_TOTAL_CONVERSIONS : 0;

    return NextResponse.json({
      date: todayStr,
      lastUpdate: now.toISOString(),

      // ===== TODAY =====
      today: {
        facebook: {
          spendAed: round(fbTodaySpend),
          spendEur: round(fbTodaySpend * AED_TO_EUR),
          leads: fbLeadsToday,
          leadsApi: fbTodayLeadsApi,
          cplAed: round(fbTodayCpl),
          cplEur: round(fbTodayCpl * AED_TO_EUR),
        },
        google: {
          spendAed: 0,
          spendEur: 0,
          leads: googleLeadsToday,
          cplAed: 0,
          cplEur: 0,
          note: 'Google Ads API en attente - spend non disponible en temps reel',
        },
        totalLeads: fbLeadsToday + googleLeadsToday,
        totalSpendAed: round(fbTodaySpend),
      },

      // ===== LIFETIME TOTALS =====
      facebook: {
        spendAed: round(fbLifetimeSpend),
        spendEur: round(fbLifetimeSpend * AED_TO_EUR),
        leads: fbLifetimeLeadsApi,
        leadsCrm: fbLeadsTotal,
        cplAed: round(fbLifetimeCpl),
        cplEur: round(fbLifetimeCpl * AED_TO_EUR),
        campaigns: fbActiveCampaigns,
        period: '8 jan - aujourd\'hui',
      },

      google: {
        spendAed: GOOGLE_ADS_TOTAL_SPEND_AED,
        spendEur: round(GOOGLE_ADS_TOTAL_SPEND_AED * AED_TO_EUR),
        leads: GOOGLE_ADS_TOTAL_CONVERSIONS,
        leadsCrm: googleLeadsTotal,
        cplAed: round(googleLifetimeCpl),
        cplEur: round(googleLifetimeCpl * AED_TO_EUR),
        campaigns: 1,
        period: '8 dec - 27 fev',
        note: 'API token expire - chiffres manuels du dashboard Google Ads',
      },

      total: {
        spendAed: round(fbLifetimeSpend + GOOGLE_ADS_TOTAL_SPEND_AED),
        spendEur: round((fbLifetimeSpend + GOOGLE_ADS_TOTAL_SPEND_AED) * AED_TO_EUR),
        leads: fbLifetimeLeadsApi + GOOGLE_ADS_TOTAL_CONVERSIONS,
        leadsCrm: fbLeadsTotal + googleLeadsTotal,
        cplAed: round((fbLifetimeSpend + GOOGLE_ADS_TOTAL_SPEND_AED) / Math.max(fbLifetimeLeadsApi + GOOGLE_ADS_TOTAL_CONVERSIONS, 1)),
        cplEur: round(((fbLifetimeSpend + GOOGLE_ADS_TOTAL_SPEND_AED) / Math.max(fbLifetimeLeadsApi + GOOGLE_ADS_TOTAL_CONVERSIONS, 1)) * AED_TO_EUR),
        campaigns: fbActiveCampaigns + 1,
      },
    });
  } catch (error: any) {
    console.error('Erreur API combined-stats:', error);
    return NextResponse.json({ error: 'Erreur serveur', details: error.message }, { status: 500 });
  }
}

function round(n: number): number {
  return parseFloat(n.toFixed(2));
}
