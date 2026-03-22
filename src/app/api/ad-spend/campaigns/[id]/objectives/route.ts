/**
 * API Route : /api/ad-spend/campaigns/[id]/objectives
 *
 * GET : Récupérer objectifs d'une campagne
 * PUT : Mettre à jour objectifs d'une campagne
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ==================== HANDLER GET ====================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;

    // Query params optionnels
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform') || 'facebook';

    // Récupérer objectif
    const objective = await prisma.campaignObjective.findUnique({
      where: {
        platform_campaignId: {
          platform,
          campaignId,
        },
      },
    });

    if (!objective) {
      return NextResponse.json(
        {
          success: false,
          error: 'Objectif non trouvé pour cette campagne',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      objective,
    });
  } catch (error: any) {
    console.error('Erreur GET /api/ad-spend/campaigns/[id]/objectives:', error);

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

// ==================== HANDLER PUT ====================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;

    // Body
    const body = await request.json();

    const {
      platform = 'facebook',
      campaignName,
      objective,
      optimizationGoal,
      targetDailyBudget,
      targetMonthlyBudget,
      targetCPL,
      targetLeadsPerDay,
      targetLeadsPerMonth,
      alertIfBudgetExceeds,
      alertIfCPLExceeds,
      alertIfLeadsBelow,
      isActive,
    } = body;

    // Upsert objectif
    const updatedObjective = await prisma.campaignObjective.upsert({
      where: {
        platform_campaignId: {
          platform,
          campaignId,
        },
      },
      create: {
        platform,
        campaignId,
        campaignName: campaignName || campaignId,
        objective: objective || 'OUTCOME_LEADS',
        optimizationGoal: optimizationGoal || 'LEAD_GENERATION',
        targetDailyBudget,
        targetMonthlyBudget,
        targetCPL,
        targetLeadsPerDay,
        targetLeadsPerMonth,
        alertIfBudgetExceeds,
        alertIfCPLExceeds,
        alertIfLeadsBelow,
        isActive: isActive !== undefined ? isActive : true,
      },
      update: {
        campaignName: campaignName || undefined,
        objective: objective || undefined,
        optimizationGoal: optimizationGoal || undefined,
        targetDailyBudget: targetDailyBudget !== undefined ? targetDailyBudget : undefined,
        targetMonthlyBudget: targetMonthlyBudget !== undefined ? targetMonthlyBudget : undefined,
        targetCPL: targetCPL !== undefined ? targetCPL : undefined,
        targetLeadsPerDay: targetLeadsPerDay !== undefined ? targetLeadsPerDay : undefined,
        targetLeadsPerMonth:
          targetLeadsPerMonth !== undefined ? targetLeadsPerMonth : undefined,
        alertIfBudgetExceeds:
          alertIfBudgetExceeds !== undefined ? alertIfBudgetExceeds : undefined,
        alertIfCPLExceeds: alertIfCPLExceeds !== undefined ? alertIfCPLExceeds : undefined,
        alertIfLeadsBelow: alertIfLeadsBelow !== undefined ? alertIfLeadsBelow : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      objective: updatedObjective,
      message: 'Objectif mis à jour avec succès',
    });
  } catch (error: any) {
    console.error('Erreur PUT /api/ad-spend/campaigns/[id]/objectives:', error);

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

// ==================== HANDLER DELETE ====================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;

    // Query params optionnels
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform') || 'facebook';

    // Supprimer objectif
    await prisma.campaignObjective.delete({
      where: {
        platform_campaignId: {
          platform,
          campaignId,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Objectif supprimé avec succès',
    });
  } catch (error: any) {
    console.error('Erreur DELETE /api/ad-spend/campaigns/[id]/objectives:', error);

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
