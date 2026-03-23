/**
 * 🎯 SERVICE CENTRAL D'INGESTION DE LEADS
 *
 * Point d'entrée unique pour toutes les sources de leads.
 * Pipeline unifié : validate → deduplicate → enrich → store → notify → log
 *
 * Architecture: Singleton pattern
 * Usage: import { leadIngestionService } from '@/lib/lead-ingestion-service'
 */

import prisma from './prisma';
import { LeadValidator } from './lead-validator';
import { LeadDeduplicator } from './lead-deduplicator';
import { NotificationManager } from './notification-manager';
import { calculateLeadScore } from './lead-scoring';
import { trackLead, trackQualifiedOwner, trackDisqualifiedLead } from './facebook-conversions-api';
import { sendToGoogleSheet } from './google-sheet-sender';
import { generateWhatsAppLink, getWelcomeMessage, isMobileNumber, sendWhatsAppTemplateWithParams } from './whatsapp';

// ===== TYPES & ENUMS =====

export enum LeadSource {
  FACEBOOK_LEAD_ADS = 'facebook_lead_ads',
  LANDING_PAGE = 'landing_page',
  EMAIL_CAMPAIGN = 'email_campaign',
  MANUAL_IMPORT = 'manual_import',
  WEBSITE_FORM = 'website_form',
  PARTNER_API = 'partner_api',
  PHONE_CALL = 'phone_call',
}

export enum ValidationStatus {
  VALID = 'valid',
  DUPLICATE = 'duplicate',
  INVALID_OWNER = 'invalid_owner',
  INVALID_ZONE = 'invalid_zone',
  INVALID_DATA = 'invalid_data',
  ERROR = 'error',
  REJECTED = 'rejected',
}

export interface RawLeadData {
  // Champs obligatoires
  firstName: string;
  lastName: string;

  // Champs optionnels
  email?: string;
  phone?: string;
  mobile?: string;
  city?: string;
  zipCode?: string;
  isOwner?: string;

  // Metadata par source
  sourceId?: string;  // fbLeadId, landingToken, etc.
  sourceMetadata?: Record<string, unknown>;  // JSON libre

  // Facebook specific
  fbLeadId?: string;
  fbFormId?: string;
  fbAdId?: string;
  fbCampaignId?: string;
  fbCampaignName?: string;
  fbAdSetId?: string;
  fbAdSetName?: string;
  fbAdName?: string;
  fbLeadCreatedTime?: Date;

  // Autres champs
  [key: string]: unknown;
}

export interface IngestionClientResult {
  id: number;
  clientNumber: number | null;
  firstName: string | null;
  lastName: string | null;
  mobile: string | null;
  email: string | null;
  city: string | null;
  zipCode: string | null;
  statusCall: string | null;
  leadScore: number | null;
  [key: string]: unknown;
}

export interface IngestionResult {
  success: boolean;
  client?: IngestionClientResult;
  status: ValidationStatus;
  error?: string;
  processingTime: number;  // ms
}

export interface IngestionLogEntry {
  source: string;
  status: string;
  clientId?: number;
  error?: string;
  processingTime: number;
  rawData?: Record<string, unknown>;
}

// ===== SERVICE =====

export class LeadIngestionService {
  private validator: LeadValidator;
  private deduplicator: LeadDeduplicator;
  private notificationManager: NotificationManager;

  constructor() {
    this.validator = new LeadValidator();
    this.deduplicator = new LeadDeduplicator();
    this.notificationManager = new NotificationManager();
  }

  /**
   * 🎯 Point d'entrée unique pour ingestion de lead
   */
  async ingest(source: LeadSource, rawData: RawLeadData): Promise<IngestionResult> {
    const startTime = Date.now();

    console.log(`[LeadIngestion] ${new Date().toISOString()} - START - Source: ${source}`);

    try {
      // 1. Validation
      console.log(`[LeadIngestion] Step 1/7: Validation`);
      const validationResult = await this.validator.validateBySource(source, rawData);

      if (!validationResult.valid) {
        await this.logIngestion({
          source,
          status: validationResult.status,
          error: validationResult.error,
          processingTime: Date.now() - startTime,
          rawData,
        });

        console.log(`[LeadIngestion] ❌ REJECTED - ${validationResult.error}`);

        // CAPI DisqualifiedLead pour locataires rejetés AVANT insertion
        // Facebook reçoit le signal négatif même si le lead n'est pas stocké en DB
        if (rawData.isOwner && rawData.isOwner !== "Oui" && rawData.isOwner !== "À vérifier" && rawData.fbLeadId) {
          try {
            const normalizedPhone = (rawData.mobile || rawData.phone || "")
              .replace(/\s/g, "").replace(/^\+33/, "0") || undefined;
            await trackDisqualifiedLead(
              {
                id: 0,
                email: rawData.email ? rawData.email.toLowerCase().trim() : undefined,
                mobile: normalizedPhone,
                firstName: rawData.firstName || undefined,
                lastName: rawData.lastName || undefined,
                city: rawData.city || undefined,
                zipCode: rawData.zipCode || undefined,
                fbLeadId: rawData.fbLeadId,
                fbCampaignId: rawData.fbCampaignId || undefined,
              },
              rawData.isOwner
            );
            console.log(`[LeadIngestion] ✅ DisqualifiedLead CAPI sent for REJECTED lead (isOwner: ${rawData.isOwner}, fbLeadId: ${rawData.fbLeadId})`);
          } catch (capiError) {
            console.error(`[LeadIngestion] ⚠️  DisqualifiedLead CAPI failed for rejected lead:`, capiError);
          }
        }

        return {
          success: false,
          status: validationResult.status,
          error: validationResult.error,
          processingTime: Date.now() - startTime,
        };
      }

      // 2. Normalisation
      console.log(`[LeadIngestion] Step 2/7: Normalization`);
      const normalizedData = this.normalize(rawData);

      // 3. Déduplication
      console.log(`[LeadIngestion] Step 3/7: Deduplication`);
      const duplicate = await this.deduplicator.findDuplicate(normalizedData);

      if (duplicate) {
        await this.logIngestion({
          source,
          status: ValidationStatus.DUPLICATE,
          clientId: duplicate.id,
          error: `Duplicate of client ${duplicate.id}`,
          processingTime: Date.now() - startTime,
          rawData,
        });

        console.log(`[LeadIngestion] ⚠️  DUPLICATE - Existing client ID: ${duplicate.id} - envoi notif reconversion`);

        // Statuts "froids" → on passe à REINSCRIT
        const COLD_STATUSES = ['NRP', 'PAS INTERESSE', 'PAS ELIGIBLE', 'FAUX NUM'];
        const currentStatus = duplicate.statusCall || '';
        const shouldReinscrit = COLD_STATUSES.includes(currentStatus.toUpperCase().trim());

        if (shouldReinscrit) {
          try {
            // Ajouter une entrée dans callHistory
            interface CallHistoryEntry {
              date: string;
              user: string;
              action: string;
              detail: string;
              newValue: string;
            }
            let history: CallHistoryEntry[] = [];
            try { history = JSON.parse(duplicate.callHistory || '[]'); } catch {}
            history.push({
              date: new Date().toISOString(),
              user: 'Système',
              action: 'Reconversion',
              detail: `Nouveau formulaire FB soumis (était ${currentStatus})`,
              newValue: 'REINSCRIT',
            });

            await prisma.client.update({
              where: { id: duplicate.id },
              data: {
                statusCall: 'REINSCRIT',
                callHistory: JSON.stringify(history),
                // Mettre à jour l'attribution FB avec la nouvelle campagne
                ...(rawData.fbLeadId    && { fbLeadId:      rawData.fbLeadId }),
                ...(rawData.fbCampaignId && { fbCampaignId: rawData.fbCampaignId }),
                ...(rawData.fbCampaignName && { fbCampaignName: rawData.fbCampaignName }),
                ...(rawData.fbAdId      && { fbAdId:        rawData.fbAdId }),
                ...(rawData.fbFormId    && { fbFormId:      rawData.fbFormId }),
                ...(rawData.fbFormName  && { fbFormName:    rawData.fbFormName }),
              },
            });
            // Recalculer le score après changement de statut
            try {
              const { calculateLeadScore } = await import('./lead-scoring');
              const refreshed = await prisma.client.findUnique({ where: { id: duplicate.id } });
              if (refreshed) {
                const score = calculateLeadScore(refreshed);
                await prisma.client.update({
                  where: { id: duplicate.id },
                  data: { leadScore: score.total, leadPriority: score.priority, leadScoreDetails: JSON.stringify(score.details), leadScoreUpdatedAt: new Date() },
                });
              }
            } catch (scoreErr) {
              console.error(`[LeadIngestion] ⚠️  Recalcul score échoué:`, scoreErr);
            }
            console.log(`[LeadIngestion] ✅ Client ${duplicate.id} passé REINSCRIT (était ${currentStatus})`);
          } catch (err) {
            console.error(`[LeadIngestion] ⚠️  Mise à jour REINSCRIT échouée:`, err);
          }
        } else {
          console.log(`[LeadIngestion] ℹ️  Statut "${currentStatus}" actif → pas de changement de statut`);
          // Mettre à jour fbLeadId pour que l'idempotence fonctionne sur les retries Facebook
          if (rawData.fbLeadId) {
            try {
              await prisma.client.update({
                where: { id: duplicate.id },
                data: { fbLeadId: rawData.fbLeadId },
              });
            } catch {}
          }
        }

        // 🔄 Notifier reconversion Telegram (toujours, peu importe le statut)
        try {
          const { sendTelegramMessage } = await import('./telegram');
          // Recharger le client pour avoir le statut mis à jour
          const updatedClient = shouldReinscrit
            ? await prisma.client.findUnique({ where: { id: duplicate.id } }) ?? duplicate
            : duplicate;
          const message = this.notificationManager.formatReconversionMessage(updatedClient, rawData, source);
          await sendTelegramMessage(message);
          console.log(`[LeadIngestion] ✅ Notif reconversion envoyée pour client ${duplicate.id}`);
        } catch (err) {
          console.error(`[LeadIngestion] ⚠️  Notif reconversion échouée:`, err);
        }

        return {
          success: false,
          status: ValidationStatus.DUPLICATE,
          client: duplicate,
          processingTime: Date.now() - startTime,
        };
      }

      // 4. Enrichissement
      console.log(`[LeadIngestion] Step 4/7: Enrichment`);
      const enrichedData = await this.enrich(normalizedData);

      // 5. Lead Scoring
      console.log(`[LeadIngestion] Step 5/7: Lead Scoring`);
      const score = calculateLeadScore(enrichedData);

      // 6. Stockage
      console.log(`[LeadIngestion] Step 6/7: Storage`);
      const client = await this.store({
        ...enrichedData,
        sourceType: source,
        sourceMetadata: JSON.stringify(rawData.sourceMetadata || {}),
        ingestedAt: new Date(),
        validatedAt: new Date(),
        validationStatus: ValidationStatus.VALID,
        leadScore: score.total,
        leadPriority: score.priority,
        leadScoreDetails: JSON.stringify(score.details),
        leadScoreUpdatedAt: new Date(),
      });

      // 7. Log succès
      await this.logIngestion({
        source,
        status: ValidationStatus.VALID,
        clientId: client.id,
        processingTime: Date.now() - startTime,
        rawData,
      });

      // 7.5. Auto-assign à un télépros (si setting activé)
      try {
        const autoAssignSetting = await prisma.setting.findUnique({ where: { key: 'auto_assign_leads' } });
        if (autoAssignSetting?.value === 'true') {
          const teleposId = await this.getNextAvailableTelepos();
          if (teleposId) {
            await prisma.client.update({ where: { id: client.id }, data: { teleposId } });
            await prisma.notification.create({
              data: {
                userId: teleposId,
                type: "new_lead",
                title: `Nouveau lead: ${(client.lastName || "")} ${(client.firstName || "")}`.trim(),
                message: "Un nouveau lead vous a été assigné automatiquement.",
                clientId: client.id,
              },
            });
            console.log(`[LeadIngestion] ✅ Auto-assigned to telepos ID: ${teleposId}`);
          } else {
            console.log(`[LeadIngestion] ℹ️  Auto-assign: aucun télépros actif trouvé`);
          }
        }
      } catch (err) {
        console.error(`[LeadIngestion] ⚠️  Auto-assign failed:`, err);
      }

      // 8. Facebook Pixel Conversions API (avec score lead)
      console.log(`[LeadIngestion] Step 7/9: Facebook Pixel`);
      try {
        await trackLead(
          {
            id: client.id,
            email: client.email || undefined,
            mobile: client.mobile || undefined,
            firstName: client.firstName || undefined,
            lastName: client.lastName || undefined,
            city: client.city || undefined,
            zipCode: client.zipCode || undefined,
          },
          score.total, // Score /100
          score.priority // "TRÈS HAUTE", "HAUTE", etc.
        );
        console.log(`[LeadIngestion] ✅ Facebook Pixel sent (score: ${score.total}/100, priority: ${score.priority})`);
      } catch (error) {
        console.error(`[LeadIngestion] ⚠️  Facebook Pixel failed:`, error);
        // Ne pas faire échouer l'ingestion si pixel échoue
      }

      // 8b. QualifiedOwner CAPI (si propriétaire confirmé + score >= 40)
      if (enrichedData.isOwner === "Oui" && score.total >= 40) {
        try {
          await trackQualifiedOwner(
            {
              id: client.id,
              email: client.email || undefined,
              mobile: client.mobile || undefined,
              firstName: client.firstName || undefined,
              lastName: client.lastName || undefined,
              city: client.city || undefined,
              zipCode: client.zipCode || undefined,
              fbLeadId: client.fbLeadId || undefined,
              fbCampaignId: client.fbCampaignId || undefined,
              fbAdSetId: client.fbAdSetId || undefined,
              fbAdId: client.fbAdId || undefined,
              fbFormId: client.fbFormId || undefined,
            },
            score.total
          );
          // Mark as sent
          await prisma.client.update({
            where: { id: client.id },
            data: { pixelQualifiedSent: true },
          });
          console.log(`[LeadIngestion] ✅ QualifiedOwner CAPI sent (owner: ${enrichedData.isOwner}, score: ${score.total})`);
        } catch (error) {
          console.error(`[LeadIngestion] ⚠️  QualifiedOwner CAPI failed:`, error);
        }
      }

      // 8c. DisqualifiedLead CAPI (si NON propriétaire → signal négatif à Facebook)
      if (enrichedData.isOwner && enrichedData.isOwner !== "Oui" && enrichedData.isOwner !== "À vérifier") {
        try {
          await trackDisqualifiedLead(
            {
              id: client.id,
              email: client.email || undefined,
              mobile: client.mobile || undefined,
              firstName: client.firstName || undefined,
              lastName: client.lastName || undefined,
              city: client.city || undefined,
              zipCode: client.zipCode || undefined,
              fbLeadId: client.fbLeadId || undefined,
            },
            enrichedData.isOwner // "Non" (nouveau système) ou valeur legacy
          );
          console.log(`[LeadIngestion] ✅ DisqualifiedLead CAPI sent (isOwner: ${enrichedData.isOwner})`);
        } catch (error) {
          console.error(`[LeadIngestion] ⚠️  DisqualifiedLead CAPI failed:`, error);
        }
      }

      // 8d. DisqualifiedLead CAPI pour faux numéros étrangers et hors zone géographique
      const normalizedMobile = (client.mobile || '').replace(/\s/g, '');
      const isForeignPhone = normalizedMobile.length > 0 && normalizedMobile.startsWith('+') && !normalizedMobile.startsWith('+33');
      const targetZones = ['13', '30', '83', '84'];
      const isOutOfZone = !!(client.zipCode && !targetZones.some(z => (client.zipCode || '').startsWith(z)));
      const alreadySentDisqualified = !!(enrichedData.isOwner && enrichedData.isOwner !== "Oui" && enrichedData.isOwner !== "À vérifier");

      if ((isForeignPhone || isOutOfZone) && !alreadySentDisqualified) {
        const reason = isForeignPhone ? 'FAUX_NUMERO' : 'HORS_ZONE';
        try {
          await trackDisqualifiedLead(
            {
              id: client.id,
              email: client.email || undefined,
              mobile: client.mobile || undefined,
              firstName: client.firstName || undefined,
              lastName: client.lastName || undefined,
              city: client.city || undefined,
              zipCode: client.zipCode || undefined,
              fbLeadId: client.fbLeadId || undefined,
              fbCampaignId: client.fbCampaignId || undefined,
              fbAdSetId: client.fbAdSetId || undefined,
              fbAdId: client.fbAdId || undefined,
              fbFormId: client.fbFormId || undefined,
            },
            reason
          );
          await prisma.client.update({
            where: { id: client.id },
            data: { pixelDisqualifiedSent: true },
          });
          console.log(`[LeadIngestion] ✅ DisqualifiedLead CAPI sent (${reason}, score: ${score.total})`);
        } catch (error) {
          console.error(`[LeadIngestion] ⚠️  DisqualifiedLead CAPI failed (${reason}):`, error);
        }
      }

      // 9. Notifications Telegram + CRM
      console.log(`[LeadIngestion] Step 8/11: Notifications Telegram + CRM`);
      await this.notificationManager.notify({
        event: 'new_lead',
        client,
        priority: score.priority,
        source: source,
      });

      // 10. Envoi vers Google Sheet (avec données EN CLAIR, pas chiffrées)
      console.log(`[LeadIngestion] Step 9/11: Google Sheet`);
      try {
        await sendToGoogleSheet({
          firstName: enrichedData.firstName,  // ✅ Données en clair
          lastName: enrichedData.lastName,    // ✅ Données en clair
          mobile: enrichedData.mobile || undefined,  // ✅ Données en clair
          email: enrichedData.email || undefined,    // ✅ Données en clair
          zipCode: enrichedData.zipCode || undefined,
          isOwner: enrichedData.isOwner || undefined,
          houseSurface: enrichedData.houseSurface || undefined,
          source: source,
        });
        console.log(`[LeadIngestion] ✅ Google Sheet notified`);
      } catch (error) {
        console.error(`[LeadIngestion] ⚠️  Google Sheet failed:`, error);
        // Ne pas faire échouer l'ingestion si Google Sheet échoue
      }

      // 11. WhatsApp : lien wa.me + envoi auto template si setting activé
      console.log(`[LeadIngestion] Step 10/11: WhatsApp`);
      try {
        const phone = enrichedData.mobile || enrichedData.phone;
        if (phone && isMobileNumber(phone)) {
          // Générer lien wa.me (pour Telegram / CRM)
          const waLink = generateWhatsAppLink(phone, getWelcomeMessage(enrichedData.firstName));
          console.log(`[LeadIngestion] 💬 Lien WhatsApp: ${waLink}`);

          // Auto-envoi template si setting activé ET lead propriétaire
          const autoWaSetting = await prisma.setting.findUnique({ where: { key: 'auto_wa_welcome' } });
          if (autoWaSetting?.value === 'true' && enrichedData.isOwner === 'Oui') {
            const sent = await sendWhatsAppTemplateWithParams(
              phone,
              'esf_welcome_lead',
              [enrichedData.firstName || 'Bonjour']
            );
            if (sent) {
              console.log(`[LeadIngestion] ✅ WhatsApp auto-welcome envoyé à ${enrichedData.firstName}`);
            }
          }
        } else {
          console.log(`[LeadIngestion] ⚠️  Pas de mobile valide pour WhatsApp`);
        }
      } catch (error) {
        console.error(`[LeadIngestion] ⚠️  WhatsApp failed:`, error);
      }

      console.log(`[LeadIngestion] ✅ SUCCESS - Client ID: ${client.id} - Score: ${score.total}/100 - ${Date.now() - startTime}ms`);

      return {
        success: true,
        client,
        status: ValidationStatus.VALID,
        processingTime: Date.now() - startTime,
      };

    } catch (error: unknown) {
      console.error('[LeadIngestion] ❌ ERROR:', error);

      await this.logIngestion({
        source,
        status: ValidationStatus.ERROR,
        error: error.message,
        processingTime: Date.now() - startTime,
        rawData,
      });

      return {
        success: false,
        status: ValidationStatus.ERROR,
        error: error.message,
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Normaliser les données (téléphone, email, noms)
   */
  private normalize(data: RawLeadData): RawLeadData {
    // Normaliser téléphone (supprimer espaces, +33 → 0)
    if (data.phone) {
      data.phone = data.phone.replace(/\s/g, '').replace(/^\+33/, '0');
    }
    if (data.mobile) {
      data.mobile = data.mobile.replace(/\s/g, '').replace(/^\+33/, '0');
    }

    // Normaliser email (lowercase)
    if (data.email) {
      data.email = data.email.toLowerCase().trim();
    }

    // Capitaliser noms
    if (data.firstName) {
      data.firstName = this.capitalize(data.firstName);
    }
    if (data.lastName) {
      data.lastName = data.lastName.toUpperCase();
    }

    return data;
  }

  /**
   * Enrichir les données (géolocalisation, etc.)
   */
  private async enrich(data: RawLeadData): Promise<RawLeadData> {
    // Enrichir city depuis zipCode
    if (data.zipCode && !data.city) {
      data.city = this.getCityFromZipCode(data.zipCode);
    }

    return data;
  }

  /**
   * Stocker dans la base de données
   */
  private async store(data: RawLeadData): Promise<IngestionClientResult> {
    // Auto-assign sequential clientNumber
    const maxNumResult = await prisma.client.aggregate({ _max: { clientNumber: true } });
    const nextClientNumber = (maxNumResult._max.clientNumber ?? 0) + 1;

    return await prisma.client.create({
      data: {
        clientNumber: nextClientNumber,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone1: data.phone || data.mobile,
        mobile: data.mobile,
        city: data.city,
        zipCode: data.zipCode,
        isOwner: data.isOwner,

        // Source tracking
        sourceType: data.sourceType,
        sourceMetadata: data.sourceMetadata,
        ingestedAt: data.ingestedAt,
        validatedAt: data.validatedAt,
        validationStatus: data.validationStatus,

        // Scoring
        leadScore: data.leadScore,
        leadPriority: data.leadPriority,
        leadScoreDetails: data.leadScoreDetails,
        leadScoreUpdatedAt: data.leadScoreUpdatedAt,

        // Facebook specific
        fbLeadId: data.fbLeadId,
        fbFormId: data.fbFormId,
        fbAdId: data.fbAdId,
        fbCampaignId: data.fbCampaignId,
        fbCampaignName: data.fbCampaignName,
        fbAdSetId: data.fbAdSetId,
        fbAdSetName: data.fbAdSetName,
        fbAdName: data.fbAdName,
        fbLeadCreatedTime: data.fbLeadCreatedTime,

        // Statut initial
        statusCall: 'NEW',
        campaign: this.getCampaignName(data.sourceType),
        observation: `Lead ${data.sourceType} inséré le ${new Date().toLocaleDateString('fr-FR')}`,

        // Pixel (sera envoyé juste après)
        pixelLeadSent: true,
      }
    });
  }

  private async logIngestion(log: IngestionLogEntry): Promise<void> {
    try {
      await prisma.leadIngestionLog.create({
        data: {
          source: log.source,
          status: log.status,
          clientId: log.clientId || null,
          error: log.error || null,
          processingTime: log.processingTime,
          rawData: JSON.stringify(log.rawData),
          createdAt: new Date(),
        }
      });
    } catch (error) {
      console.error('[LeadIngestion] Failed to log:', error);
    }
  }

  // ===== HELPERS =====

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  private getCityFromZipCode(zipCode: string): string {
    const dept = zipCode.substring(0, 2);
    const cities: Record<string, string> = {
      '13': 'Marseille',
      '30': 'Nîmes',
      '83': 'Toulon',
      '84': 'Avignon',
      '06': 'Nice',
    };
    return cities[dept] || 'PACA';
  }

  /**
   * Trouver le télépros actif avec le moins de leads actifs (load-balancing)
   */
  private async getNextAvailableTelepos(): Promise<number | null> {
    const telepros = await prisma.user.findMany({
      where: { role: "telepos", active: true },
      select: { id: true },
    });
    if (telepros.length === 0) return null;

    const counts = await Promise.all(
      telepros.map(async (tp) => ({
        id: tp.id,
        count: await prisma.client.count({
          where: {
            teleposId: tp.id,
            statusCall: { in: ["NEW", "NRP", "A RAPPELER"] },
            deletedAt: null,
          },
        }),
      }))
    );

    counts.sort((a, b) => a.count - b.count);
    return counts[0].id;
  }

  private getCampaignName(source: LeadSource): string {
    const names: Record<LeadSource, string> = {
      [LeadSource.FACEBOOK_LEAD_ADS]: 'FACEBOOK_LEAD_ADS',
      [LeadSource.LANDING_PAGE]: process.env.LANDING_DOMAIN?.replace(/^https?:\/\//, "") || "landing-page",
      [LeadSource.EMAIL_CAMPAIGN]: 'EMAIL_CAMPAIGN',
      [LeadSource.MANUAL_IMPORT]: 'IMPORT_MANUEL',
      [LeadSource.WEBSITE_FORM]: 'SITE_WEB',
      [LeadSource.PARTNER_API]: 'PARTENAIRE',
      [LeadSource.PHONE_CALL]: 'APPEL_ENTRANT',
    };
    return names[source] || 'AUTRE';
  }
}

// Export singleton
export const leadIngestionService = new LeadIngestionService();
