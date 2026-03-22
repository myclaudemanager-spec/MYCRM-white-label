#!/usr/bin/env node
/**
 * Synchronisation Quotidienne des Dépenses Publicitaires
 *
 * Objectif : Récupérer automatiquement les dépenses Facebook de la veille et les persister en DB
 * Exécution : Tous les jours à 2h du matin (après backup 2h)
 * Cron : 0 2 * * * cd /var/www/mycrm && node scripts/sync-ad-spend-daily.js
 */

const fs = require('fs');
const path = require('path');

// ==================== CONFIGURATION ====================

const LOG_DIR = path.join(__dirname, '..', 'logs', 'ad-spend-sync');
const LOG_FILE = path.join(LOG_DIR, `sync-${new Date().toISOString().split('T')[0]}.log`);

// Créer répertoire logs si inexistant
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ==================== LOGGER ====================

function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    data,
  };

  const logLine = `[${timestamp}] [${level}] ${message}${data ? ' | ' + JSON.stringify(data) : ''}\n`;

  // Console
  console.log(logLine.trim());

  // Fichier
  fs.appendFileSync(LOG_FILE, logLine);
}

// ==================== IMPORTS ====================

// Charger variables d'environnement
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Fetch natif (Node.js 18+)

// Config Facebook
const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
const FB_AD_ACCOUNT_ID = process.env.FB_AD_ACCOUNT_ID;

// Taux de change (source unique)
const EXCHANGE_RATES = {
  AED_TO_EUR: 0.25,
  EUR_TO_AED: 4.0,
};

function convertCurrency(amount, from, to) {
  if (from === to) return amount;
  const rateKey = `${from}_TO_${to}`;
  const rate = EXCHANGE_RATES[rateKey];
  if (!rate) {
    console.warn(`Taux non trouvé pour ${from} → ${to}`);
    return amount;
  }
  return amount * rate;
}

log('INFO', 'Modules importés avec succès');

// ==================== FONCTIONS PRINCIPALES ====================

/**
 * Récupérer les dépenses Facebook de la veille
 */
async function fetchFacebookSpend() {
  try {
    log('INFO', 'Récupération dépenses Facebook...');

    // Date d'hier (UTC)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const dateStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD

    log('INFO', `Période ciblée : ${dateStr}`);

    // Appeler Facebook API directement (sans objective_name et status qui ne sont pas supportés dans insights)
    const url = `https://graph.facebook.com/v21.0/${FB_AD_ACCOUNT_ID}/insights?access_token=${FB_ACCESS_TOKEN}&level=campaign&fields=campaign_id,campaign_name,spend,impressions,clicks,cpc,cpm,ctr,actions,cost_per_action_type&time_range={"since":"${dateStr}","until":"${dateStr}"}&limit=500`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      throw new Error(`Facebook API Error: ${data.error.message}`);
    }

    const insights = data.data || [];

    // Normaliser format pour compatibilité
    const normalizedInsights = insights.map((insight) => ({
      campaign_id: insight.campaign_id,
      campaign_name: insight.campaign_name,
      spend: parseFloat(insight.spend || 0),
      impressions: parseInt(insight.impressions || 0),
      clicks: parseInt(insight.clicks || 0),
      cpc: parseFloat(insight.cpc || 0),
      cpm: parseFloat(insight.cpm || 0),
      ctr: parseFloat(insight.ctr || 0),
      objective: null, // Non disponible dans insights
      status: null, // Non disponible dans insights
      actions: insight.actions || [],
      cost_per_action_type: insight.cost_per_action_type || [],
    }));

    log('INFO', `${normalizedInsights.length} campagnes récupérées`);

    return { insights: normalizedInsights, date: dateStr };
  } catch (error) {
    log('ERROR', 'Erreur récupération Facebook', { error: error.message });
    throw error;
  }
}

/**
 * Compter les leads CRM pour une campagne et une date
 */
async function countLeadsForCampaign(campaignId, dateStr) {
  try {
    // Début et fin de la journée
    const startDate = new Date(dateStr);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(dateStr);
    endDate.setHours(23, 59, 59, 999);

    const count = await prisma.client.count({
      where: {
        fbCampaignId: campaignId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    return count;
  } catch (error) {
    log('ERROR', `Erreur comptage leads campagne ${campaignId}`, { error: error.message });
    return 0;
  }
}

/**
 * Upsert dépenses en DB
 */
async function upsertAdSpend(insights, dateStr) {
  try {
    log('INFO', 'Upsert dépenses en base...');

    const stats = {
      created: 0,
      updated: 0,
      errors: 0,
    };

    for (const insight of insights) {
      try {
        // Compter les leads CRM pour cette campagne
        const leadsCount = await countLeadsForCampaign(insight.campaign_id, dateStr);

        // Préparer données
        const spend = parseFloat(insight.spend || 0);
        const spendEUR = convertCurrency(spend, 'AED', 'EUR');
        const impressions = parseInt(insight.impressions || 0);
        const clicks = parseInt(insight.clicks || 0);

        // Calculer CPL si leads > 0
        const cpl = leadsCount > 0 ? spend / leadsCount : null;

        // Upsert
        await prisma.adSpend.upsert({
          where: {
            platform_campaignId_date: {
              platform: 'facebook',
              campaignId: insight.campaign_id,
              date: new Date(dateStr),
            },
          },
          create: {
            platform: 'facebook',
            accountId: process.env.FB_AD_ACCOUNT_ID || 'act_1594090068684202',
            campaignId: insight.campaign_id,
            campaignName: insight.campaign_name,
            date: new Date(dateStr),
            period: 'daily',
            spend: spend,
            currency: 'AED',
            spendEUR: spendEUR,
            impressions: impressions,
            clicks: clicks,
            leads: leadsCount,
            conversions: 0, // À compléter plus tard
            cpl: cpl,
            cpc: parseFloat(insight.cpc || 0),
            cpm: parseFloat(insight.cpm || 0),
            objective: insight.objective || null,
            status: insight.status || null,
            rawData: JSON.stringify(insight),
          },
          update: {
            campaignName: insight.campaign_name,
            spend: spend,
            spendEUR: spendEUR,
            impressions: impressions,
            clicks: clicks,
            leads: leadsCount,
            cpl: cpl,
            cpc: parseFloat(insight.cpc || 0),
            cpm: parseFloat(insight.cpm || 0),
            objective: insight.objective || null,
            status: insight.status || null,
            rawData: JSON.stringify(insight),
          },
        });

        stats.updated++;

        log('INFO', `Campagne ${insight.campaign_name} synchronisée`, {
          spend: `${spend.toFixed(0)} AED`,
          spendEUR: `${spendEUR.toFixed(0)} EUR`,
          leads: leadsCount,
          cpl: cpl ? `${cpl.toFixed(0)} AED` : 'N/A',
        });
      } catch (error) {
        stats.errors++;
        log('ERROR', `Erreur upsert campagne ${insight.campaign_id}`, { error: error.message });
      }
    }

    log('INFO', 'Synchronisation terminée', stats);

    return stats;
  } catch (error) {
    log('ERROR', 'Erreur upsert global', { error: error.message });
    throw error;
  }
}

/**
 * Vérifier les objectifs et envoyer alertes si nécessaire
 */
async function checkCampaignObjectives(dateStr) {
  try {
    log('INFO', 'Vérification objectifs campagnes...');

    // Récupérer tous les objectifs actifs
    const objectives = await prisma.campaignObjective.findMany({
      where: {
        isActive: true,
      },
    });

    if (objectives.length === 0) {
      log('INFO', 'Aucun objectif configuré');
      return;
    }

    log('INFO', `${objectives.length} objectifs actifs`);

    const alerts = [];

    for (const objective of objectives) {
      // Récupérer dépenses du jour
      const adSpend = await prisma.adSpend.findUnique({
        where: {
          platform_campaignId_date: {
            platform: objective.platform,
            campaignId: objective.campaignId,
            date: new Date(dateStr),
          },
        },
      });

      if (!adSpend) {
        continue;
      }

      // Vérifier alertes

      // 1. Alerte CPL dépassé
      if (objective.alertIfCPLExceeds && adSpend.cpl && adSpend.cpl > objective.alertIfCPLExceeds) {
        alerts.push({
          type: 'cpl_exceeded',
          severity: 'warning',
          campaignId: objective.campaignId,
          campaignName: objective.campaignName,
          message: `CPL actuel (${adSpend.cpl.toFixed(0)} AED) > cible (${objective.alertIfCPLExceeds} AED)`,
          currentValue: adSpend.cpl,
          targetValue: objective.alertIfCPLExceeds,
          date: dateStr,
        });
      }

      // 2. Alerte leads insuffisants
      if (objective.alertIfLeadsBelow && adSpend.leads < objective.alertIfLeadsBelow) {
        alerts.push({
          type: 'leads_below_target',
          severity: 'warning',
          campaignId: objective.campaignId,
          campaignName: objective.campaignName,
          message: `Leads actuels (${adSpend.leads}) < cible (${objective.alertIfLeadsBelow})`,
          currentValue: adSpend.leads,
          targetValue: objective.alertIfLeadsBelow,
          date: dateStr,
        });
      }

      // 3. Alerte budget dépassé (quotidien)
      if (objective.targetDailyBudget && adSpend.spend > objective.targetDailyBudget) {
        const overspend = ((adSpend.spend / objective.targetDailyBudget - 1) * 100).toFixed(0);
        alerts.push({
          type: 'budget_exceeded',
          severity: 'critical',
          campaignId: objective.campaignId,
          campaignName: objective.campaignName,
          message: `Budget dépassé de ${overspend}%`,
          currentValue: adSpend.spend,
          targetValue: objective.targetDailyBudget,
          date: dateStr,
        });
      }
    }

    if (alerts.length > 0) {
      log('WARNING', `${alerts.length} alerte(s) détectée(s)`, { alerts });

      // TODO: Envoyer notifications (email, Telegram, etc.)
      // Pour l'instant, juste logger
    } else {
      log('INFO', 'Toutes les campagnes respectent leurs objectifs ✅');
    }

    return alerts;
  } catch (error) {
    log('ERROR', 'Erreur vérification objectifs', { error: error.message });
    return [];
  }
}

/**
 * Générer rapport de synthèse
 */
async function generateSummaryReport(stats, alerts) {
  try {
    const reportPath = path.join(LOG_DIR, `summary-${new Date().toISOString().split('T')[0]}.json`);

    const report = {
      timestamp: new Date().toISOString(),
      stats,
      alerts,
      success: stats.errors === 0,
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    log('INFO', `Rapport généré : ${reportPath}`);
  } catch (error) {
    log('ERROR', 'Erreur génération rapport', { error: error.message });
  }
}

// ==================== EXÉCUTION PRINCIPALE ====================

async function main() {
  const startTime = Date.now();

  log('INFO', '========================================');
  log('INFO', 'SYNCHRONISATION DÉPENSES PUBLICITAIRES');
  log('INFO', '========================================');

  try {
    // 1. Récupérer dépenses Facebook
    const { insights, date } = await fetchFacebookSpend();

    // 2. Upsert en DB
    const stats = await upsertAdSpend(insights, date);

    // 3. Vérifier objectifs
    const alerts = await checkCampaignObjectives(date);

    // 4. Générer rapport
    await generateSummaryReport(stats, alerts);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    log('INFO', '========================================');
    log('INFO', `SYNCHRONISATION TERMINÉE (${duration}s)`);
    log('INFO', '========================================');

    // Fermer Prisma
    await prisma.$disconnect();

    process.exit(0);
  } catch (error) {
    log('ERROR', 'ÉCHEC SYNCHRONISATION', { error: error.message, stack: error.stack });

    await prisma.$disconnect();

    process.exit(1);
  }
}

// Lancer
main();
