/**
 * API Route : Créer une campagne Facebook Ads
 * POST /api/facebook-campaigns/create
 */

import { NextRequest, NextResponse } from 'next/server';
import { createCampaign, createOptimizedCampaign } from '@/lib/facebook-campaign-manager';
import { verifyToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    // Vérification authentification
    const token = req.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const body = await req.json();
    const { type, config } = body;

    let result;

    if (type === 'optimized') {
      // Créer une campagne pré-optimisée
      const campaignType = config.campaignType as 'lookalike' | 'interest' | 'retargeting';
      result = await createOptimizedCampaign(campaignType);
    } else {
      // Créer une campagne personnalisée
      result = await createCampaign(config);
    }

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      campaign: result,
    });
  } catch (error: any) {
    console.error('Erreur création campagne:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}
