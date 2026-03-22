/**
 * API Route : Lister les campagnes Facebook Ads
 * GET /api/facebook-campaigns/list
 */

import { NextRequest, NextResponse } from 'next/server';
import { listCampaigns, getCampaignInsights } from '@/lib/facebook-campaign-manager';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    // Vérification authentification
    const token = req.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Token invalide' }, { status: 401 });
    }

    // Récupérer la liste des campagnes
    const campaigns = await listCampaigns();

    // Enrichir avec les insights des 7 derniers jours
    const campaignsWithInsights = await Promise.all(
      campaigns.map(async (campaign: any) => {
        try {
          const insights = await getCampaignInsights(campaign.id, 7);
          return {
            ...campaign,
            insights: insights || {
              spend: 0,
              impressions: 0,
              clicks: 0,
              leads: 0,
            },
          };
        } catch (error) {
          return {
            ...campaign,
            insights: null,
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      campaigns: campaignsWithInsights,
    });
  } catch (error: any) {
    console.error('Erreur récupération campagnes:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}
