#!/usr/bin/env tsx
/**
 * 🤖 BOT TELEGRAM CRM
 * Avec toutes les commandes et fonctionnalités
 */

import TelegramBot from 'node-telegram-bot-api';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const token = process.env.TELEGRAM_BOT_TOKEN || ''; // DISABLED: migre vers david-app sur myclaude

// ✅ Support multi-utilisateurs (admins)
const AUTHORIZED_CHAT_IDS = (process.env.TELEGRAM_CHAT_IDS || process.env.TELEGRAM_CHAT_ID || '611067700')
  .split(',')
  .map(id => parseInt(id.trim()))
  .filter(Boolean);

const bot = new TelegramBot(token, { polling: true });

console.log(`🤖 Bot Telegram CRM démarré pour ${AUTHORIZED_CHAT_IDS.length} utilisateur(s) !`);
console.log(`✅ Chat IDs autorisés: ${AUTHORIZED_CHAT_IDS.join(', ')}`);

// 🔒 MIDDLEWARE SÉCURITÉ : Vérifier les utilisateurs autorisés
function isAuthorized(chatId: number): boolean {
  return AUTHORIZED_CHAT_IDS.includes(chatId);
}

// /start - Bienvenue
bot.onText(/\/start/, (msg) => {
  if (!isAuthorized(msg.chat.id)) {
    bot.sendMessage(msg.chat.id, '⛔ Accès refusé. Bot privé.');
    return;
  }
  const text = `
👋 <b>Bienvenue sur le CRM Bot !</b>

🎯 Je suis ton assistant intelligent pour gérer ton CRM.

📋 <b>Commandes disponibles:</b>
   /leads - Derniers leads du jour
   /stats - Stats Facebook en temps réel
   /campagnes - État des campagnes
   /clients - Résumé clients
   /rdv - RDV aujourd'hui
   /top - Top commerciaux
   /help - Aide complète

💡 Tu recevras des notifications automatiques pour :
   🆕 Nouveaux leads Facebook
   📅 RDV pris
   🎉 Signatures
   ⚠️ Alertes CPL élevé
  `;

  bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
});

// /leads - Derniers leads
bot.onText(/\/leads/, async (msg) => {
  if (!isAuthorized(msg.chat.id)) {
    bot.sendMessage(msg.chat.id, '⛔ Accès refusé');
    return;
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const leads = await prisma.client.findMany({
      where: {
        createdAt: { gte: today }
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        city: true,
        zipCode: true,
        campaign: true,
        createdAt: true
      }
    });

    if (leads.length === 0) {
      bot.sendMessage(msg.chat.id, '📊 Aucun lead reçu aujourd\'hui');
      return;
    }

    let text = `📊 <b>DERNIERS LEADS (Aujourd'hui)</b>\n\n`;

    leads.forEach((lead, i) => {
      const timeAgo = Math.floor((Date.now() - lead.createdAt.getTime()) / 60000);
      const timeStr = timeAgo < 60 ? `il y a ${timeAgo} min` : `il y a ${Math.floor(timeAgo / 60)}h`;

      text += `${i + 1}. 🆕 ${lead.firstName} ${lead.lastName} (${timeStr})\n`;
      text += `   📍 ${lead.zipCode || ''} ${lead.city || ''}\n`;
      text += `   📋 ${lead.campaign || 'Campagne inconnue'}\n`;
      text += `   🔗 <a href="https://mycrm.solar/clients?id=${lead.id}">Voir fiche</a>\n\n`;
    });

    text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📊 Total: ${leads.length} leads aujourd'hui`;

    bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML', disable_web_page_preview: true });
  } catch (error) {
    bot.sendMessage(msg.chat.id, '❌ Erreur lors de la récupération des leads');
    console.error(error);
  }
});

// /stats - Stats du jour
bot.onText(/\/stats/, async (msg) => {
  if (!isAuthorized(msg.chat.id)) {
    bot.sendMessage(msg.chat.id, '⛔ Accès refusé');
    return;
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Leads aujourd'hui
    const todayLeads = await prisma.client.count({
      where: { createdAt: { gte: today } }
    });

    // Leads hier
    const yesterdayLeads = await prisma.client.count({
      where: {
        createdAt: {
          gte: yesterday,
          lt: today
        }
      }
    });

    const leadsChange = yesterdayLeads > 0
      ? ((todayLeads - yesterdayLeads) / yesterdayLeads * 100).toFixed(0)
      : '0';

    const text = `
📊 <b>STATISTIQUES DU JOUR</b>

🎯 <b>LEADS</b>
   Aujourd'hui: ${todayLeads} leads
   Hier: ${yesterdayLeads} leads
   Évolution: ${leadsChange > 0 ? '+' : ''}${leadsChange}% ${leadsChange > 0 ? '📈' : '📉'}

🔗 <a href="https://mycrm.solar/analytics/facebook-live">Dashboard complet</a>
    `.trim();

    bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML', disable_web_page_preview: true });
  } catch (error) {
    bot.sendMessage(msg.chat.id, '❌ Erreur lors de la récupération des stats');
    console.error(error);
  }
});

// /campagnes - État campagnes
bot.onText(/\/campagnes/, async (msg) => {
  if (!isAuthorized(msg.chat.id)) {
    bot.sendMessage(msg.chat.id, '⛔ Accès refusé');
    return;
  }

  const text = `
📋 <b>CAMPAGNES FACEBOOK</b>

✅ [V2] Lookalike 1% (ACTIVE)
   Budget: 150 AED/jour
   🟢 Lead Form optimisé

✅ [V2] Intérêts Propriétaires (ACTIVE)
   Budget: 130 AED/jour
   🟢 Lead Form optimisé

✅ [V2] Retargeting Chaud (ACTIVE)
   Budget: 70 AED/jour
   🟢 Lead Form optimisé

━━━━━━━━━━━━━━━━━━━━━━━
💰 Total: 350 AED/jour (≈83 €/jour)

🔗 <a href="https://mycrm.solar/analytics/facebook-live">Monitoring temps réel</a>
  `.trim();

  bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML', disable_web_page_preview: true });
});

// /clients - Résumé clients
bot.onText(/\/clients/, async (msg) => {
  if (!isAuthorized(msg.chat.id)) {
    bot.sendMessage(msg.chat.id, '⛔ Accès refusé');
    return;
  }

  try {
    const toCall = await prisma.client.count({
      where: { statusCall: 'A RAPPELER', archived: false }
    });

    const confirmer = await prisma.client.count({
      where: { statusCall: 'CONFIRMER', archived: false }
    });

    const rdvPris = await prisma.client.count({
      where: { statusCall: 'RDV PRIS', archived: false }
    });

    const total = await prisma.client.count({
      where: { archived: false }
    });

    const text = `
👥 <b>RÉSUMÉ CLIENTS</b>

📊 <b>STATUTS CALL (Téléprospection)</b>
   A RAPPELER: ${toCall} clients
   CONFIRMER: ${confirmer} clients
   RDV PRIS: ${rdvPris} clients

━━━━━━━━━━━━━━━━━━━━━━━
📈 Total actifs: ${total} clients

🔗 <a href="https://mycrm.solar/clients">Voir tous les clients</a>
    `.trim();

    bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML', disable_web_page_preview: true });
  } catch (error) {
    bot.sendMessage(msg.chat.id, '❌ Erreur lors de la récupération des clients');
    console.error(error);
  }
});

// /rdv - RDV aujourd'hui
bot.onText(/\/rdv/, async (msg) => {
  if (!isAuthorized(msg.chat.id)) {
    bot.sendMessage(msg.chat.id, '⛔ Accès refusé');
    return;
  }

  try {
    const rdvClients = await prisma.client.findMany({
      where: {
        statusCall: 'RDV PRIS',
        archived: false
      },
      take: 10,
      include: {
        commercial1: true
      }
    });

    if (rdvClients.length === 0) {
      bot.sendMessage(msg.chat.id, '📅 Aucun RDV confirmé actuellement');
      return;
    }

    let text = `📅 <b>RDV CONFIRMÉS</b>\n\n`;

    rdvClients.forEach((client, i) => {
      text += `${i + 1}. ${client.firstName} ${client.lastName}\n`;
      text += `   📍 ${client.zipCode || ''} ${client.city || ''}\n`;
      text += `   💼 ${client.commercial1?.name || 'Non assigné'}\n`;
      text += `   🔗 <a href="https://mycrm.solar/clients?id=${client.id}">Voir fiche</a>\n\n`;
    });

    text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📊 Total: ${rdvClients.length} RDV confirmés`;

    bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML', disable_web_page_preview: true });
  } catch (error) {
    bot.sendMessage(msg.chat.id, '❌ Erreur lors de la récupération des RDV');
    console.error(error);
  }
});

// /top - Top commerciaux
bot.onText(/\/top/, async (msg) => {
  if (!isAuthorized(msg.chat.id)) {
    bot.sendMessage(msg.chat.id, '⛔ Accès refusé');
    return;
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        role: { in: ['commercial', 'admin'] }
      },
      select: {
        id: true,
        name: true,
        role: true,
        clientsAsCommercial1: {
          where: {
            statusRDV: { contains: 'SIGNÉ' }
          }
        }
      }
    });

    let text = `🏆 <b>TOP COMMERCIAUX</b>\n\n`;

    users.forEach((user, i) => {
      const signatures = user.clientsAsCommercial1.length;
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '👤';

      text += `${medal} ${user.name}\n`;
      text += `   💰 ${signatures} signature(s)\n\n`;
    });

    bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
  } catch (error) {
    bot.sendMessage(msg.chat.id, '❌ Erreur lors de la récupération du top');
    console.error(error);
  }
});

// /help - Aide complète
bot.onText(/\/help/, (msg) => {
  if (!isAuthorized(msg.chat.id)) {
    bot.sendMessage(msg.chat.id, '⛔ Accès refusé');
    return;
  }

  const text = `
📚 <b>AIDE COMPLÈTE</b>

<b>Commandes disponibles:</b>

/leads - Derniers leads du jour
/stats - Stats Facebook en temps réel
/campagnes - État des campagnes actives
/clients - Résumé clients par statut
/rdv - Liste des RDV confirmés
/top - Classement des commerciaux
/help - Cette aide

<b>Notifications automatiques:</b>

🆕 Nouveau lead Facebook
📅 RDV pris
🎉 Signature contrat
⚠️ Alerte CPL élevé
💰 Budget dépassé

<b>Rapports automatiques:</b>

☀️ Quotidien (8h du matin)
📈 Hebdomadaire (Lundi 9h)

🔗 <a href="https://mycrm.solar">Accéder au CRM</a>
  `.trim();

  bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML', disable_web_page_preview: true });
});

// Gestion des erreurs
bot.on('polling_error', (error) => {
  console.error('❌ Erreur polling:', error);
});

// Garder le processus actif
process.on('SIGINT', async () => {
  console.log('\n🛑 Arrêt du bot...');
  await bot.stopPolling();
  await prisma.$disconnect();
  process.exit(0);
});

console.log('✅ Bot prêt à recevoir des commandes !');
