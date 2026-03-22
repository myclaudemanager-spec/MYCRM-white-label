/**
 * API Route : Mettre à jour une campagne Facebook Ads
 * POST /api/facebook-campaigns/update
 */

import { NextRequest, NextResponse } from 'next/server';
import { updateCampaignStatus } from '@/lib/facebook-campaign-manager';
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
    const { campaignId, status } = body;

    if (!campaignId || !status) {
      return NextResponse.json(
        { error: 'campaignId et status requis' },
        { status: 400 }
      );
    }

    if (!['ACTIVE', 'PAUSED', 'DELETED'].includes(status)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
    }

    const result = await updateCampaignStatus(campaignId, status);

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Campagne ${status === 'ACTIVE' ? 'activée' : status === 'PAUSED' ? 'mise en pause' : 'supprimée'}`,
    });
  } catch (error: any) {
    console.error('Erreur mise à jour campagne:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}
