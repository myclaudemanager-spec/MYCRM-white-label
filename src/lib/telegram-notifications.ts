import { sendTelegramMessage } from './telegram';
import prisma from './prisma';

/**
 * Créer une notification dans le CRM pour tous les admins
 */
async function createNotificationInCRM(data: {
  type: string;
  title: string;
  message: string;
  clientId?: number;
}) {
  try {
    // Récupérer tous les admins
    const admins = await prisma.user.findMany({
      where: { role: 'admin' },
      select: { id: true }
    });

    // Créer une notification pour chaque admin
    await Promise.all(
      admins.map(admin =>
        prisma.notification.create({
          data: {
            userId: admin.id,
            type: data.type,
            title: data.title,
            message: data.message,
            clientId: data.clientId || null,
            read: false
          }
        })
      )
    );
  } catch (error) {
    console.error('❌ Erreur création notification CRM:', error);
  }
}

/**
 * 🆕 Notification nouveau lead Facebook
 */
export async function notifyNewLead(clientId: number) {
  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId }
    });

    if (!client) return false;

    // 1. Créer notification dans le CRM (cloche)
    await createNotificationInCRM({
      type: 'new_lead',
      title: `Nouveau lead: ${client.firstName} ${client.lastName}`,
      message: `${client.city || 'Ville inconnue'} - ${client.campaign || 'Campagne inconnue'}`,
      clientId: client.id
    });

    // 2. Envoyer notification Telegram
    const ownerStatus = client.isOwner || 'Non renseigné';

    // Déterminer l'emoji et l'alerte selon le statut
    let ownerEmoji = '✅';
    let alertMessage = '';

    const ownerLower = ownerStatus.toLowerCase();
    // IMPORTANT: Vérifier "non renseigné" EN ENTIER avant "non" seul
    if (ownerLower === 'non renseigné') {
      ownerEmoji = '⚠️';
      alertMessage = '\n\n⚠️ Statut propriétaire non renseigné - À vérifier';
    } else if (ownerLower.includes('locataire') || ownerLower === 'non') {
      ownerEmoji = '🚨';
      alertMessage = '\n\n🚨 <b>ATTENTION: A déclaré être LOCATAIRE !</b>\n⚠️ À vérifier - Peut s\'être trompé';
    } else if (ownerLower.includes('oui') || ownerLower.includes('propriétaire')) {
      ownerEmoji = '✅';
    } else {
      ownerEmoji = '⚠️';
      alertMessage = '\n\n⚠️ Statut propriétaire non renseigné - À vérifier';
    }

    const message = `
🆕 <b>Nouveau Lead Facebook !</b>

👤 <b>${client.firstName} ${client.lastName}</b>
📞 ${client.mobile || 'Non renseigné'}
📍 ${client.zipCode || ''} ${client.city || ''}
🏠 ${ownerEmoji} Propriétaire: ${ownerStatus}${alertMessage}

📋 Campagne: ${client.campaign || 'Non spécifié'}
⏰ Reçu: À l'instant

🔗 <a href="https://mycrm.solar/clients?openClient=${client.id}">Voir la fiche</a>
    `.trim();

    return await sendTelegramMessage(message);
  } catch (error) {
    console.error('❌ Erreur notification lead:', error);
    return false;
  }
}

/**
 * 📅 Notification RDV pris
 */
export async function notifyRDVPris(clientId: number) {
  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId }
    });

    if (!client) return false;

    let rdvLabel = 'Date non définie';
    if (client.rdvDate) {
      const d = new Date(client.rdvDate);
      rdvLabel = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      if (client.rdvTime) rdvLabel += ` à ${client.rdvTime}`;
    }

    const message = `
📅 <b>RDV Pris !</b>

👤 <b>${client.firstName} ${client.lastName}</b>
📍 ${client.zipCode || ''} ${client.city || ''}
🕐 <b>${rdvLabel}</b>

📝 Note: ${client.observation || 'Aucune note'}

🔗 <a href="https://mycrm.solar/planning">Voir planning</a>
    `.trim();

    return await sendTelegramMessage(message);
  } catch (error) {
    console.error('❌ Erreur notification RDV:', error);
    return false;
  }
}

/**
 * 🎉 Notification signature contrat
 */
export async function notifySignature(clientId: number) {
  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId }
    });

    if (!client) return false;

    const message = `
🎉 <b>SIGNATURE !</b>

👤 <b>${client.firstName} ${client.lastName}</b>
📍 ${client.zipCode || ''} ${client.city || ''}

🔗 <a href="https://mycrm.solar/clients?id=${client.id}">Voir fiche</a>
    `.trim();

    return await sendTelegramMessage(message);
  } catch (error) {
    console.error('❌ Erreur notification signature:', error);
    return false;
  }
}

/**
 * ⚠️ Alerte CPL élevé
 */
export async function notifyHighCPL(campaignName: string, cpl: number, spent: number, leads: number) {
  const message = `
⚠️ <b>ALERTE CPL ÉLEVÉ !</b>

📋 Campagne: ${campaignName}
💸 CPL actuel: ${cpl.toFixed(2)} AED (> objectif 60 AED)
📊 Dépenses aujourd'hui: ${spent.toFixed(2)} AED
🎯 Leads: ${leads}

💡 <b>Actions recommandées:</b>
   1. Vérifier le ciblage
   2. Tester nouvelles créatives
   3. Réduire budget si nécessaire

🔗 <a href="https://mycrm.solar/analytics/facebook-live">Dashboard</a>
  `.trim();

  return await sendTelegramMessage(message);
}

/**
 * 💰 Alerte budget dépassé
 */
export async function notifyBudgetExceeded(dailyBudget: number, spent: number) {
  const percentage = ((spent - dailyBudget) / dailyBudget * 100).toFixed(0);

  const message = `
💰 <b>Budget Facebook Quotidien Dépassé !</b>

📊 Budget prévu: ${dailyBudget} AED/jour
💸 Dépensé aujourd'hui: ${spent.toFixed(2)} AED (+${percentage}%)

⚠️ Risque de dépassement mensuel

🔗 <a href="https://mycrm.solar/analytics/facebook-live">Voir dépenses</a>
  `.trim();

  return await sendTelegramMessage(message);
}

/**
 * 📊 Rapport quotidien
 */
export async function sendDailyReport() {
  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);

    // Compter leads d'hier
    const yesterdayLeads = await prisma.client.count({
      where: {
        createdAt: {
          gte: yesterday,
          lt: todayStart
        }
      }
    });

    // Clients à rappeler aujourd'hui
    const toCall = await prisma.client.count({
      where: {
        statusCall: 'A RAPPELER',
        archived: false
      }
    });

    // RDV aujourd'hui
    const rdvToday = await prisma.client.count({
      where: {
        statusCall: 'RDV PRIS',
        archived: false
      }
    });

    // Ne rien envoyer si aucune activité
    if (yesterdayLeads === 0 && toCall === 0 && rdvToday === 0) {
      console.log('ℹ️  Aucune activité hier, rapport quotidien ignoré');
      return true;
    }

    const message = `
☀️ <b>Rapport ${today.toLocaleDateString('fr-FR')}</b>

📊 Hier: ${yesterdayLeads} lead${yesterdayLeads > 1 ? 's' : ''}
📞 À rappeler: ${toCall}
📅 RDV: ${rdvToday}

🔗 <a href="https://mycrm.solar/analytics/facebook-live">Dashboard</a>
    `.trim();

    return await sendTelegramMessage(message);
  } catch (error) {
    console.error('❌ Erreur rapport quotidien:', error);
    return false;
  }
}

/**
 * 📈 Rapport hebdomadaire
 */
export async function sendWeeklyReport() {
  try {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Leads de la semaine
    const weekLeads = await prisma.client.count({
      where: {
        createdAt: {
          gte: weekAgo
        }
      }
    });

    // RDV signés
    const signatures = await prisma.client.count({
      where: {
        statusRDV: { contains: 'SIGNÉ' },
        createdAt: { gte: weekAgo }
      }
    });

    // Ne rien envoyer si aucune activité
    if (weekLeads === 0 && signatures === 0) {
      console.log('ℹ️  Aucune activité cette semaine, rapport ignoré');
      return true;
    }

    const message = `
📊 <b>Semaine du ${weekAgo.toLocaleDateString('fr-FR')}</b>

🎯 ${weekLeads} lead${weekLeads > 1 ? 's' : ''}
✅ ${signatures} signature${signatures > 1 ? 's' : ''}

🔗 <a href="https://mycrm.solar/dashboard">Dashboard</a>
    `.trim();

    return await sendTelegramMessage(message);
  } catch (error) {
    console.error('❌ Erreur rapport hebdomadaire:', error);
    return false;
  }
}
