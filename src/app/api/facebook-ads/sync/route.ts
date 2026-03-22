import { NextRequest, NextResponse } from 'next/server';
import { fbAdsService } from '@/lib/facebook-ads';
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * API Route: POST /api/facebook-ads/sync
 *
 * Synchronise les leads Facebook Lead Ads dans le CRM
 *
 * Query params:
 * - since: Date au format YYYY-MM-DD (optionnel, défaut: 7 jours)
 * - dryRun: true/false (optionnel, défaut: false) - Si true, ne crée pas les leads
 */
export async function POST(request: NextRequest) {
  try {
    // Vérifier authentification (admin uniquement)
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const sinceParam = searchParams.get('since');
    const dryRun = searchParams.get('dryRun') === 'true';

    // Par défaut : 7 derniers jours
    const since = sinceParam || getDateDaysAgo(7);

    console.log(`[Facebook Sync] Démarrage - Since: ${since}, DryRun: ${dryRun}`);

    // Récupérer tous les leads Facebook depuis la date
    const fbLeads = await fbAdsService.getAllLeads(since);

    if (fbLeads.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aucun nouveau lead Facebook',
        newLeads: 0,
        updated: 0,
        errors: 0,
      });
    }

    console.log(`[Facebook Sync] ${fbLeads.length} lead(s) trouvé(s) sur Facebook`);

    let newLeads = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    for (const fbLead of fbLeads) {
      try {
        // Extraire les données du formulaire
        const fieldData = parseFieldData(fbLead.field_data);

        if (!fieldData.firstName || !fieldData.phone) {
          console.warn(`[Facebook Sync] Lead ${fbLead.id} incomplet (pas de nom/téléphone)`);
          skipped++;
          continue;
        }

        // Vérifier si le lead existe déjà
        const existingClient = await prisma.client.findFirst({
          where: {
            OR: [
              { fbLeadId: fbLead.id },
              { phone1: fieldData.phone },
              {
                AND: [
                  { firstName: fieldData.firstName },
                  { lastName: fieldData.lastName || '' },
                ],
              },
            ],
          },
        });

        if (existingClient) {
          // Lead déjà existant
          if (existingClient.fbLeadId === fbLead.id) {
            console.log(`[Facebook Sync] Lead ${fbLead.id} déjà synchronisé (skip)`);
            skipped++;
            continue;
          }

          // Lead existant mais pas encore lié à Facebook
          if (!dryRun) {
            await prisma.client.update({
              where: { id: existingClient.id },
              data: {
                fbLeadId: fbLead.id,
                fbCampaignId: fbLead.campaign_id,
                fbCampaignName: fbLead.campaign_name || null,
                fbAdSetId: fbLead.adset_id,
                fbAdSetName: fbLead.adset_name || null,
                fbAdId: fbLead.ad_id,
                fbAdName: fbLead.ad_name || null,
                fbFormId: fbLead.form_id,
                fbLeadCreatedTime: new Date(fbLead.created_time),
                fbSyncedAt: new Date(),
              },
            });

            // Log action
            await prisma.action.create({
              data: {
                clientId: existingClient.id,
                type: 'modification',
                detail: `Lead Facebook associé (campagne: ${fbLead.campaign_name || fbLead.campaign_id})`,
              },
            });
          }

          updated++;
          console.log(
            `[Facebook Sync] Lead ${fbLead.id} lié à client existant #${existingClient.id}`
          );
        } else {
          // Nouveau lead à créer
          if (!dryRun) {
            const newClient = await prisma.client.create({
              data: {
                firstName: fieldData.firstName,
                lastName: fieldData.lastName || '',
                email: fieldData.email || null,
                phone1: fieldData.phone,
                address: fieldData.address || '',
                zipCode: fieldData.zipCode || null,
                city: fieldData.city || null,
                campaign: fbLead.campaign_name || `FB Campaign ${fbLead.campaign_id}`,
                statusCall: 'NOUVEAU LEAD',
                fbLeadId: fbLead.id,
                fbCampaignId: fbLead.campaign_id,
                fbCampaignName: fbLead.campaign_name || null,
                fbAdSetId: fbLead.adset_id,
                fbAdSetName: fbLead.adset_name || null,
                fbAdId: fbLead.ad_id,
                fbAdName: fbLead.ad_name || null,
                fbFormId: fbLead.form_id,
                fbLeadCreatedTime: new Date(fbLead.created_time),
                fbSyncedAt: new Date(),
              },
            });

            // Log action
            await prisma.action.create({
              data: {
                clientId: newClient.id,
                type: 'creation',
                detail: `Lead Facebook créé (campagne: ${fbLead.campaign_name || fbLead.campaign_id})`,
              },
            });

            console.log(
              `[Facebook Sync] Nouveau lead créé #${newClient.id} depuis campagne ${fbLead.campaign_name}`
            );
          }

          newLeads++;
        }
      } catch (error: any) {
        console.error(`[Facebook Sync] Erreur lead ${fbLead.id}:`, error.message);
        errors++;
        errorDetails.push(`Lead ${fbLead.id}: ${error.message}`);
      }
    }

    const summary = {
      success: true,
      message: dryRun
        ? `Simulation terminée (aucune donnée créée)`
        : `Synchronisation terminée`,
      since,
      totalFbLeads: fbLeads.length,
      newLeads,
      updated,
      skipped,
      errors,
      errorDetails: errors > 0 ? errorDetails : undefined,
    };

    console.log('[Facebook Sync] Résumé:', summary);

    return NextResponse.json(summary);
  } catch (error: any) {
    console.error('[Facebook Sync] Erreur fatale:', error);
    return NextResponse.json(
      {
        error: 'Erreur serveur',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * Parser les données du formulaire Facebook Lead Ads
 */
function parseFieldData(fieldData: Array<{ name: string; values: string[] }>) {
  const data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    address?: string;
    zipCode?: string;
    city?: string;
  } = {};

  for (const field of fieldData) {
    const name = field.name.toLowerCase();
    const value = field.values[0]?.trim();

    if (!value) continue;

    // Mapping des champs Facebook → CRM
    if (name === 'first_name' || name === 'prénom' || name === 'prenom') {
      data.firstName = value;
    } else if (name === 'last_name' || name === 'nom' || name === 'nom_de_famille') {
      data.lastName = value;
    } else if (name === 'full_name' || name === 'nom_complet') {
      // Si nom complet, séparer prénom/nom
      const parts = value.split(' ');
      data.firstName = parts[0];
      data.lastName = parts.slice(1).join(' ');
    } else if (name === 'email') {
      data.email = value;
    } else if (name === 'phone_number' || name === 'téléphone' || name === 'telephone') {
      // Nettoyer le numéro
      data.phone = value.replace(/\s/g, '');
    } else if (name === 'street_address' || name === 'adresse') {
      data.address = value;
    } else if (name === 'zip_code' || name === 'code_postal' || name === 'postal_code') {
      data.zipCode = value;
    } else if (name === 'city' || name === 'ville') {
      data.city = value;
    }
  }

  return data;
}

/**
 * Obtenir une date X jours en arrière au format YYYY-MM-DD
 */
function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}
