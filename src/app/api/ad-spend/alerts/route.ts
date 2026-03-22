/**
 * API Route : /api/ad-spend/alerts
 *
 * GET : Récupérer toutes les alertes actives (CPL dépassé, budget dépassé, leads insuffisants)
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ==================== TYPES ====================

interface Alert {
  type: 'cpl_exceeded' | 'budget_exceeded' | 'leads_below_target' | 'no_data';
  severity: 'info' | 'warning' | 'critical';
  campaignId: string;
  campaignName: string;
  platform: string;
  message: string;
  currentValue: number;
  targetValue: number;
  date: string;
}

// ==================== HANDLER GET ====================

export async function GET(request: NextRequest) {
  try {
    // Query params
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform') || 'all';
    const severity = searchParams.get('severity') || 'all'; // 'all' | 'warning' | 'critical'

    // Récupérer tous les objectifs actifs
    const objectives = await prisma.campaignObjective.findMany({
      where: {
        isActive: true,
        ...(platform !== 'all' ? { platform } : {}),
      },
    });

    if (objectives.length === 0) {
      return NextResponse.json({
        success: true,
        alerts: [],
        message: 'Aucun objectif configuré',
      });
    }

    // Date d'aujourd'hui et hier
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const alerts: Alert[] = [];

    // Vérifier chaque objectif
    for (const objective of objectives) {
      // Récupérer dépenses d'hier (plus fiable que aujourd'hui en cours)
      const adSpendYesterday = await prisma.adSpend.findUnique({
        where: {
          platform_campaignId_date: {
            platform: objective.platform,
            campaignId: objective.campaignId,
            date: yesterday,
          },
        },
      });

      // Récupérer dépenses du mois en cours pour budget mensuel
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const adSpendsMonth = await prisma.adSpend.findMany({
        where: {
          platform: objective.platform,
          campaignId: objective.campaignId,
          date: {
            gte: firstDayOfMonth,
            lte: today,
          },
        },
      });

      const monthlySpend = adSpendsMonth.reduce((sum: number, spend: any) => sum + spend.spend, 0);
      const monthlyLeads = adSpendsMonth.reduce((sum: number, spend: any) => sum + spend.leads, 0);

      // Si pas de données hier
      if (!adSpendYesterday) {
        alerts.push({
          type: 'no_data',
          severity: 'info',
          campaignId: objective.campaignId,
          campaignName: objective.campaignName,
          platform: objective.platform,
          message: `Aucune donnée hier pour ${objective.campaignName}`,
          currentValue: 0,
          targetValue: 0,
          date: yesterday.toISOString().split('T')[0],
        });
        continue;
      }

      // 1. Alerte CPL dépassé
      if (
        objective.alertIfCPLExceeds &&
        adSpendYesterday.cpl &&
        adSpendYesterday.cpl > objective.alertIfCPLExceeds
      ) {
        const overCPL = ((adSpendYesterday.cpl / objective.alertIfCPLExceeds - 1) * 100).toFixed(
          0
        );

        alerts.push({
          type: 'cpl_exceeded',
          severity: adSpendYesterday.cpl > objective.alertIfCPLExceeds * 1.5 ? 'critical' : 'warning',
          campaignId: objective.campaignId,
          campaignName: objective.campaignName,
          platform: objective.platform,
          message: `CPL hier (${adSpendYesterday.cpl.toFixed(0)} AED) dépasse la cible (${objective.alertIfCPLExceeds} AED) de ${overCPL}%`,
          currentValue: adSpendYesterday.cpl,
          targetValue: objective.alertIfCPLExceeds,
          date: yesterday.toISOString().split('T')[0],
        });
      }

      // 2. Alerte leads insuffisants
      if (
        objective.alertIfLeadsBelow &&
        adSpendYesterday.leads < objective.alertIfLeadsBelow
      ) {
        const missingLeads = objective.alertIfLeadsBelow - adSpendYesterday.leads;

        alerts.push({
          type: 'leads_below_target',
          severity: adSpendYesterday.leads === 0 ? 'critical' : 'warning',
          campaignId: objective.campaignId,
          campaignName: objective.campaignName,
          platform: objective.platform,
          message: `Leads hier (${adSpendYesterday.leads}) en dessous de la cible (${objective.alertIfLeadsBelow}) - manque ${missingLeads} leads`,
          currentValue: adSpendYesterday.leads,
          targetValue: objective.alertIfLeadsBelow,
          date: yesterday.toISOString().split('T')[0],
        });
      }

      // 3. Alerte budget quotidien dépassé
      if (
        objective.targetDailyBudget &&
        adSpendYesterday.spend > objective.targetDailyBudget
      ) {
        const overBudget = (
          (adSpendYesterday.spend / objective.targetDailyBudget - 1) *
          100
        ).toFixed(0);

        alerts.push({
          type: 'budget_exceeded',
          severity: adSpendYesterday.spend > objective.targetDailyBudget * 1.2 ? 'critical' : 'warning',
          campaignId: objective.campaignId,
          campaignName: objective.campaignName,
          platform: objective.platform,
          message: `Budget hier (${adSpendYesterday.spend.toFixed(0)} AED) dépasse la cible (${objective.targetDailyBudget} AED) de ${overBudget}%`,
          currentValue: adSpendYesterday.spend,
          targetValue: objective.targetDailyBudget,
          date: yesterday.toISOString().split('T')[0],
        });
      }

      // 4. Alerte budget mensuel dépassé
      if (objective.targetMonthlyBudget && monthlySpend > objective.targetMonthlyBudget) {
        const overBudget = ((monthlySpend / objective.targetMonthlyBudget - 1) * 100).toFixed(0);

        alerts.push({
          type: 'budget_exceeded',
          severity: monthlySpend > objective.targetMonthlyBudget * 1.2 ? 'critical' : 'warning',
          campaignId: objective.campaignId,
          campaignName: objective.campaignName,
          platform: objective.platform,
          message: `Budget mensuel (${monthlySpend.toFixed(0)} AED) dépasse la cible (${objective.targetMonthlyBudget} AED) de ${overBudget}%`,
          currentValue: monthlySpend,
          targetValue: objective.targetMonthlyBudget,
          date: today.toISOString().split('T')[0],
        });
      }

      // 5. Alerte leads mensuels insuffisants
      const currentDay = today.getDate();
      const expectedLeadsToDate = objective.targetLeadsPerMonth
        ? Math.floor((objective.targetLeadsPerMonth / 30) * currentDay)
        : null;

      if (expectedLeadsToDate && monthlyLeads < expectedLeadsToDate * 0.8) {
        // Si < 80% de l'objectif attendu
        alerts.push({
          type: 'leads_below_target',
          severity: monthlyLeads < expectedLeadsToDate * 0.5 ? 'critical' : 'warning',
          campaignId: objective.campaignId,
          campaignName: objective.campaignName,
          platform: objective.platform,
          message: `Leads mensuels (${monthlyLeads}) en retard - attendu ${expectedLeadsToDate} à ce jour`,
          currentValue: monthlyLeads,
          targetValue: expectedLeadsToDate,
          date: today.toISOString().split('T')[0],
        });
      }
    }

    // Filtrer par sévérité si demandé
    let filteredAlerts = alerts;
    if (severity !== 'all') {
      filteredAlerts = alerts.filter((alert) => alert.severity === severity);
    }

    // Trier par sévérité (critical > warning > info)
    filteredAlerts.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    return NextResponse.json({
      success: true,
      alerts: filteredAlerts,
      count: filteredAlerts.length,
      breakdown: {
        critical: filteredAlerts.filter((a) => a.severity === 'critical').length,
        warning: filteredAlerts.filter((a) => a.severity === 'warning').length,
        info: filteredAlerts.filter((a) => a.severity === 'info').length,
      },
    });
  } catch (error: any) {
    console.error('Erreur /api/ad-spend/alerts:', error);

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
