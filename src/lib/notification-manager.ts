/**
 * 📢 GESTIONNAIRE DE NOTIFICATIONS CENTRALISÉ
 *
 * Envoie des notifications sur tous les canaux :
 * - Telegram (admins + téléprospecteurs)
 * - CRM (cloche interne)
 * - Email (futur)
 * - SMS (futur)
 *
 * Format uniforme selon priorité du lead
 */

import { sendTelegramMessage } from './telegram';
import prisma from './prisma';
import { decryptClient } from './encryption';
import { sendWhatsAppNotificationToM } from './whatsapp';

export interface NotificationEvent {
  event: 'new_lead' | 'rdv_pris' | 'signature' | 'installation' | 'reconversion';
  client: any;
  priority: string;  // "TRÈS HAUTE", "HAUTE", "MOYENNE", "BASSE"
  source: string;
  metadata?: Record<string, any>;
}

export class NotificationManager {
  /**
   * 🎯 Envoyer notifications sur tous les canaux configurés
   */
  async notify(event: NotificationEvent): Promise<void> {
    try {
      console.log(`[NotificationManager] Sending notifications for ${event.event} - Client ${event.client.id}`);

      // Canal 1: Telegram (admins + telepos)
      await this.sendTelegram(event);

      // Canal 2: CRM (cloche interne)
      await this.sendCRMNotification(event);

      // Canal 3: WhatsApp (propriétaire M)
      await this.sendWhatsAppToM(event);

      // Canal 4: Email (désactivé par défaut)
      // await this.sendEmail(event);

      // Canal 5: SMS (futur)
      // await this.sendSMS(event);

      console.log(`[NotificationManager] ✅ Notifications sent successfully`);

    } catch (error) {
      console.error('[NotificationManager] ❌ Error sending notifications:', error);
      // Ne pas faire échouer l'ingestion si notification échoue
    }
  }

  /**
   * 📱 Envoyer notification Telegram
   */
  private async sendTelegram(event: NotificationEvent): Promise<void> {
    const message = this.formatTelegramMessage(event);

    try {
      await sendTelegramMessage(message);
      console.log('[NotificationManager] ✅ Telegram sent');
    } catch (error) {
      console.error('[NotificationManager] ❌ Telegram failed:', error);
    }
  }

  /**
   * 🔔 Envoyer notification CRM (cloche interne)
   */
  private async sendCRMNotification(event: NotificationEvent): Promise<void> {
    try {
      // Récupérer admins + telepos actifs
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { role: 'admin' },
            { role: 'telepos' },
          ],
          active: true,
        },
        select: { id: true },
      });

      if (users.length === 0) {
        console.log('[NotificationManager] ⚠️  No users to notify');
        return;
      }

      const title = this.getCRMNotificationTitle(event);
      const message = this.getCRMNotificationMessage(event);

      await prisma.notification.createMany({
        data: users.map(user => ({
          userId: user.id,
          clientId: event.client.id,
          type: event.event,
          title,
          message,
          read: false,
        })),
      });

      console.log(`[NotificationManager] ✅ CRM notifications created for ${users.length} users`);

    } catch (error) {
      console.error('[NotificationManager] ❌ CRM notification failed:', error);
    }
  }

  /**
   * 📱 Envoyer notification WhatsApp à M (propriétaire)
   */
  private async sendWhatsAppToM(event: NotificationEvent): Promise<void> {
    try {
      // Déchiffrer les données du client
      const decryptedClient = decryptClient(event.client) || event.client;

      await sendWhatsAppNotificationToM({
        firstName: decryptedClient.firstName || '',
        lastName: decryptedClient.lastName || '',
        mobile: decryptedClient.mobile || undefined,
        email: decryptedClient.email || undefined,
        city: decryptedClient.city || undefined,
        zipCode: decryptedClient.zipCode || undefined,
        priority: event.priority,
        score: decryptedClient.leadScore || 0,
        source: event.source,
        clientId: decryptedClient.id,
      });

      console.log('[NotificationManager] ✅ WhatsApp to M sent');
    } catch (error) {
      console.error('[NotificationManager] ❌ WhatsApp to M failed:', error);
    }
  }

  // ===== FORMATAGE MESSAGES =====

  /**
   * Échapper caractères HTML pour Telegram
   */
  private escapeHtml(text: string | null | undefined): string {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * 📊 Extraire informations de campagne/plateforme
   */
  private getCampaignInfo(client: any, source: string): {
    platform: string;
    platformShort: string; // Pour le titre (ex: "FACEBOOK")
    campaignName: string;
    formName?: string;
  } {
    if (source === 'facebook_lead_ads') {
      return {
        platform: '📘 Facebook',
        platformShort: 'FACEBOOK',
        campaignName: client.fbCampaignName || `Campagne ${client.fbCampaignId || 'Inconnue'}`,
        formName: client.fbFormName || `Form ${client.fbFormId || 'N/A'}`,
      };
    }

    if (source === 'landing_page') {
      const metadata = typeof client.sourceMetadata === 'string'
        ? JSON.parse(client.sourceMetadata || '{}')
        : (client.sourceMetadata || {});

      return {
        platform: '🌐 Landing Page',
        platformShort: 'LANDING PAGE',
        campaignName: metadata.source || process.env.LANDING_DOMAIN || 'votre landing page',
      };
    }

    if (source === 'google_ads' || source.includes('google')) {
      return {
        platform: '🔍 Google Ads',
        platformShort: 'GOOGLE ADS',
        campaignName: client.campaign || 'Google Ads',
      };
    }

    if (source.toLowerCase().includes('tiktok')) {
      return {
        platform: '🎵 TikTok Ads',
        platformShort: 'TIKTOK',
        campaignName: client.campaign || 'TikTok',
      };
    }

    return {
      platform: '📋 Autre',
      platformShort: 'AUTRE',
      campaignName: client.campaign || source,
    };
  }

  /**
   * ⏰ Formater timestamp en français (Timezone Israel)
   */
  private getFormattedTimestamp(client: any): string {
    // Priorité : fbLeadCreatedTime (Facebook) > ingestedAt > createdAt
    const date = client.fbLeadCreatedTime || client.ingestedAt || client.createdAt;

    if (!date) return 'N/A';

    const d = new Date(date);
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jerusalem', // 🇮🇱 Timezone Israel (GMT+2/+3)
    });
  }

  /**
   * Format message Telegram reconversion (doublon = contact qui revient)
   */
  formatReconversionMessage(existingClient: any, newLeadData: any, source: string): string {
    const decrypted = decryptClient(existingClient) || existingClient;
    const mobile = decrypted.mobile || decrypted.phone1;
    let whatsappLink = '';
    if (mobile) {
      const phoneClean = mobile.replace(/\s/g, '').replace(/^0/, '33');
      const welcomeMsg = encodeURIComponent(`Bonjour ${decrypted.firstName}, suite à votre demande concernant ${process.env.LANDING_PRODUCT || 'nos services'}, notre conseiller va vous contacter prochainement.`);
      whatsappLink = `\n💬 <a href="https://wa.me/${phoneClean}?text=${welcomeMsg}">Contacter sur WhatsApp</a>`;
    }

    const firstSeenDate = decrypted.createdAt
      ? new Date(decrypted.createdAt).toLocaleDateString('fr-FR', { timeZone: 'Asia/Jerusalem' })
      : 'Inconnue';

    const statusCall = decrypted.statusCall || 'Non défini';
    const statusRdv  = decrypted.statusRDV  || '';
    const campaign   = newLeadData?.fbCampaignName || source;

    const COLD_STATUSES = ['NRP', 'PAS INTERESSE', 'PAS ELIGIBLE', 'FAUX NUM'];
    const wasReinscrit = COLD_STATUSES.includes(statusCall.toUpperCase().trim());
    const statusLine = wasReinscrit
      ? `🟣 Statut mis à jour: <b>REINSCRIT</b> (était ${this.escapeHtml(statusCall)})`
      : `📋 Statut actuel: ${this.escapeHtml(statusCall)} (inchangé — déjà actif)`;

    return `
🔄 <b>RECONVERSION — Contact existant</b>

👤 <b>${this.escapeHtml(decrypted.firstName)} ${this.escapeHtml(decrypted.lastName)}</b>
📞 ${this.escapeHtml(mobile) || 'Non renseigné'}
📧 ${this.escapeHtml(decrypted.email) || 'Non renseigné'}
📍 ${this.escapeHtml(decrypted.zipCode)} ${this.escapeHtml(decrypted.city)}
🏠 Propriétaire: ${this.escapeHtml(decrypted.isOwner || 'Non renseigné')}

📋 <b>Historique CRM (ID ${decrypted.id})</b>
├ Premier contact: ${firstSeenDate}
├ ${statusLine}
${statusRdv ? `└ Statut RDV: ${this.escapeHtml(statusRdv)}` : '└ Aucun RDV'}

📘 Revenu via: ${this.escapeHtml(campaign)}
⚠️ <b>Ce contact a soumis un nouveau formulaire — il est à recontacter !</b>

🔗 <a href="${process.env.CRM_BASE_URL || 'https://mycrm.solar'}/clients?openClient=${decrypted.id}">Ouvrir la fiche</a>${whatsappLink}
    `.trim();
  }

  /**
   * Format message Telegram (avec emojis et HTML)
   */
  private formatTelegramMessage(event: NotificationEvent): string {
    const { client, priority, source } = event;

    // 🔓 DÉCHIFFRER les données AVANT de les envoyer sur Telegram
    const decryptedClient = decryptClient(client) || client;

    // Emoji selon priorité
    const priorityEmoji = {
      'TRÈS HAUTE': '🔥',
      'HAUTE': '⭐',
      'MOYENNE': '📞',
      'BASSE': '💤',
    }[priority] || '📋';

    // Emoji propriétaire
    let ownerEmoji = '✅';
    let ownerAlert = '';
    const isOwner = decryptedClient.isOwner || 'Non renseigné';
    const ownerLower = isOwner.toLowerCase();

    if (ownerLower === 'non renseigné' || ownerLower === 'à vérifier') {
      ownerEmoji = '⚠️';
      ownerAlert = '\n⚠️ Statut propriétaire à vérifier';
    } else if (ownerLower.includes('locataire') || ownerLower === 'non') {
      ownerEmoji = '🚨';
      ownerAlert = '\n🚨 <b>ATTENTION: LOCATAIRE déclaré !</b>';
    }

    // 🎯 NOUVEAU : Extraire infos campagne/formulaire
    const campaignInfo = this.getCampaignInfo(decryptedClient, source);
    const timestamp = this.getFormattedTimestamp(decryptedClient);

    // 💬 Générer lien WhatsApp si numéro mobile disponible
    const mobile = decryptedClient.mobile || decryptedClient.phone1;
    let whatsappLink = '';
    if (mobile) {
      const phoneClean = mobile.replace(/\s/g, '').replace(/^0/, '33');
      const firstName = this.escapeHtml(decryptedClient.firstName);
      const welcomeMsg = encodeURIComponent(`Bonjour ${firstName}, suite à votre demande concernant ${process.env.LANDING_PRODUCT || 'nos services'}, notre conseiller va vous contacter prochain.`);
      whatsappLink = `\n💬 <a href="https://wa.me/${phoneClean}?text=${welcomeMsg}">Contacter sur WhatsApp</a>`;
    }

    // 🎯 NOUVEAU FORMAT ENRICHI
    const message = `
${priorityEmoji} <b>Nouveau Lead ${campaignInfo.platformShort}</b>

👤 <b>${this.escapeHtml(decryptedClient.firstName)} ${this.escapeHtml(decryptedClient.lastName)}</b>
📞 ${this.escapeHtml(mobile) || 'Non renseigné'}
📧 ${this.escapeHtml(decryptedClient.email) || 'Non renseigné'}
📍 ${this.escapeHtml(decryptedClient.zipCode)} ${this.escapeHtml(decryptedClient.city)}
🏠 ${ownerEmoji} Propriétaire: ${this.escapeHtml(isOwner)}${ownerAlert}

📊 Score: ${decryptedClient.leadScore || 0}/100 pts (Priorité: ${priority})
${campaignInfo.platform} Plateforme
🎯 Campagne: ${this.escapeHtml(campaignInfo.campaignName)}${campaignInfo.formName ? `\n📝 Formulaire: ${this.escapeHtml(campaignInfo.formName)}` : ''}
⏰ Créé: ${timestamp}

🔗 <a href="${process.env.CRM_BASE_URL || 'https://mycrm.solar'}/clients?openClient=${decryptedClient.id}">Voir la fiche</a>${whatsappLink}
    `.trim();

    return message;
  }

  /**
   * Format titre notification CRM
   */
  private getCRMNotificationTitle(event: NotificationEvent): string {
    const { priority, client } = event;

    const priorityPrefix = {
      'TRÈS HAUTE': '🔥',
      'HAUTE': '⭐',
      'MOYENNE': '',
      'BASSE': '',
    }[priority] || '';

    return `${priorityPrefix} Nouveau lead: ${client.firstName} ${client.lastName}`.trim();
  }

  /**
   * Format message notification CRM
   */
  private getCRMNotificationMessage(event: NotificationEvent): string {
    const { client, source } = event;
    return `${client.city || 'Ville inconnue'} - ${source} - Score: ${client.leadScore || 0}/100`;
  }
}
