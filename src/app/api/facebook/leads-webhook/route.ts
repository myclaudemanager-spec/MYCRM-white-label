/**
 * 🔔 WEBHOOK FACEBOOK LEAD ADS
 *
 * Reçoit automatiquement les leads Facebook et les ingère via le service central.
 * REFACTORÉ pour utiliser LeadIngestionService.
 */

import { NextRequest, NextResponse } from "next/server";
import { leadIngestionService, LeadSource } from "@/lib/lead-ingestion-service";
import prisma from "@/lib/prisma";

const VERIFY_TOKEN = "bhcompany_webhook_secret_2026";
/**
 * Normaliser la valeur isOwner du formulaire Facebook
 * Support du nouveau formulaire avec emojis (oui__✅, non_❌)
 */
function normalizeIsOwner(raw: string | undefined): string {
  if (!raw) return "À vérifier";
  const v = raw.toLowerCase().trim();

  // Support du nouveau formulaire avec emojis et ancien format
  if (v.includes("oui") || v.includes("yes") || v.includes("propriétaire") || v.includes("maison")) {
    return "Oui";
  }

  if (v.includes("non") || v.includes("locataire") || v.includes("tenant") || v.includes("appartement")) {
    return "Non";
  }

  return "Non";
}


/**
 * GET - Vérification webhook (Facebook envoie ça pour vérifier l'endpoint)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook Facebook vérifié");
    return new NextResponse(challenge, { status: 200 });
  }

  console.log("❌ Vérification webhook échouée");
  return NextResponse.json({ error: "Vérification échouée" }, { status: 403 });
}

/**
 * POST - Réception des leads Facebook
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log(`[FacebookWebhook] ${new Date().toISOString()} - Webhook reçu`);

    // Facebook envoie plusieurs entries
    if (body.object === "page") {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.field === "leadgen") {
            const leadgenId = change.value.leadgen_id;
            const formId = change.value.form_id;
            const adId = change.value.ad_id;
            const createdTime = change.value.created_time;

            console.log(`[FacebookWebhook] 📋 Nouveau lead: ${leadgenId}`);

            // Check idempotence : skip si déjà traité (prévient les doubles notifs sur retry Facebook)
            const alreadyProcessed = await prisma.client.findFirst({
              where: { fbLeadId: leadgenId },
              select: { id: true }
            });
            if (alreadyProcessed) {
              console.log(`[FacebookWebhook] ⏭️ Lead ${leadgenId} déjà traité (Client ${alreadyProcessed.id}) → skip`);
              continue;
            }

            // Récupérer les données du lead via API Facebook
            const leadData = await fetchLeadData(leadgenId);

            if (!leadData) {
              console.log(`[FacebookWebhook] ❌ Lead ${leadgenId} non récupéré (erreur API Facebook)`);
              continue;
            }

            // 🎯 DÉLÉGUER au service central d'ingestion
            const result = await leadIngestionService.ingest(LeadSource.FACEBOOK_LEAD_ADS, {
              ...leadData,
              fbLeadId: leadgenId,
              fbFormId: formId,
              fbAdId: adId,
              fbLeadCreatedTime: new Date(createdTime * 1000),
              sourceMetadata: {
                leadgenId,
                formId,
                adId,
                createdTime,
                webhookReceivedAt: new Date().toISOString(),
              }
            });

            if (result.success) {
              console.log(`[FacebookWebhook] ✅ Lead ${leadgenId} ingéré avec succès - Client ID: ${result.client.id}`);
            } else {
              console.log(`[FacebookWebhook] ❌ Lead ${leadgenId} rejeté - Status: ${result.status} - ${result.error}`);

              // ✅ Toujours retourner 200 à Facebook (webhook doit confirmer réception)
              // L'éducation du ciblage se fait via CAPI events (QualifiedOwner/DisqualifiedLead), pas via HTTP codes
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[FacebookWebhook] ❌ Erreur webhook:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * 📥 Récupérer nom de la campagne Facebook
 */
async function fetchCampaignName(campaignId: string): Promise<string | null> {
  const token = process.env.FB_ACCESS_TOKEN || "";

  try {
    const res = await fetch(
      `https://graph.facebook.com/v22.0/${campaignId}?fields=name&access_token=${token}`
    );
    const data = await res.json();

    if (data.error) {
      console.error(`[FacebookWebhook] ⚠️ Erreur récupération nom campagne ${campaignId}:`, data.error.message);
      return null;
    }

    return data.name || null;
  } catch (error) {
    console.error(`[FacebookWebhook] ❌ Erreur fetch campaign name ${campaignId}:`, error);
    return null;
  }
}

/**
 * 📝 Récupérer nom du formulaire Facebook
 */
async function fetchFormName(formId: string): Promise<string | null> {
  const token = process.env.FB_ACCESS_TOKEN || "";

  try {
    const res = await fetch(
      `https://graph.facebook.com/v22.0/${formId}?fields=name&access_token=${token}`
    );
    const data = await res.json();

    if (data.error) {
      console.error(`[FacebookWebhook] ⚠️ Erreur récupération nom formulaire ${formId}:`, data.error.message);
      return null;
    }

    return data.name || null;
  } catch (error) {
    console.error(`[FacebookWebhook] ❌ Erreur fetch form name ${formId}:`, error);
    return null;
  }
}

/**
 * 📥 Récupérer données lead depuis Facebook Graph API
 */
async function fetchLeadData(leadgenId: string) {
  const token = process.env.FB_ACCESS_TOKEN || "";

  try {
    const res = await fetch(
      `https://graph.facebook.com/v22.0/${leadgenId}?fields=id,created_time,field_data,campaign_id,adset_id,ad_id,form_id&access_token=${token}`
    );

    const data = await res.json();

    if (data.error) {
      console.error(`[FacebookWebhook] ❌ Erreur récupération lead ${leadgenId}:`, data.error.message);
      return null;
    }

    // Transformer field_data en objet utilisable
    const leadInfo: any = {};

    console.log(`[FacebookWebhook] 📋 Parsing ${data.field_data.length} champs Facebook`);

    data.field_data.forEach((field: any) => {
      const name = field.name.toLowerCase();
      const value = field.values[0];

      // Mapper les champs Facebook vers champs CRM
      if (name === "full_name" || name === "nom_complet") {
        const parts = value.trim().split(/\s+/);
        if (parts.length >= 2) {
          leadInfo.firstName = parts[0];
          leadInfo.lastName = parts.slice(1).join(" ");
        } else {
          // Nom unique sans espace (ex: "archevêque", "Bernard..Jacques")
          leadInfo.firstName = "-";
          leadInfo.lastName = value.trim();
        }
      } else if (name === "first_name" || name === "prénom" || name === "prenom") {
        leadInfo.firstName = value;
      } else if (name === "last_name" || name === "nom") {
        leadInfo.lastName = value;
      } else if (name === "email") {
        leadInfo.email = value;
      } else if (name === "phone_number" || name === "phone" || name === "téléphone" || name === "telephone") {
        leadInfo.mobile = value;
        console.log(`[FacebookWebhook] 📞 Téléphone capturé: "${value}"`);
      } else if (name === "city" || name === "ville") {
        leadInfo.city = value;
      } else if (name === "zip_code" || name === "post_code" || name === "code_postal" || name === "postcode") {
        leadInfo.zipCode = value;
        console.log(`[FacebookWebhook] 📍 Code postal capturé: "${value}"`);
      }
      // 🏠 CAPTURE DU STATUT PROPRIÉTAIRE (tous les formats possibles)
      else if (
        name.includes("propriétaire") ||
        name.includes("proprietaire") ||
        name.includes("owner") ||
        name === "housing_status" ||
        name === "statut_proprietaire" ||
        name === "property_type_house" ||
        name === "type_logement"
      ) {
        leadInfo.isOwner = normalizeIsOwner(value);
        console.log(`[FacebookWebhook] 🏠 Statut propriétaire capturé: "${value}" → normalisé: "${leadInfo.isOwner}"`);
      }
      // 📏 CAPTURE DE LA SURFACE DE LA MAISON
      else if (name.includes("surface")) {
        leadInfo.surface = value;
        console.log(`[FacebookWebhook] 📏 Surface maison capturée: "${value}" m²`);
      }
      // 🏠 CAPTURE DU CHAMP CUSTOM (réponse formulaire propriétaire)
      else if (name === "custom") {
        leadInfo.isOwner = normalizeIsOwner(value);
        console.log(`[FacebookWebhook] 🏠 Réponse formulaire CUSTOM capturée: "${value}" → normalisé: "${leadInfo.isOwner}"`);
      }
    });

    // Extraire attribution Facebook (campaign_id, adset_id, ad_id, form_id)
    if (data.campaign_id) leadInfo.fbCampaignId = data.campaign_id;
    if (data.adset_id) leadInfo.fbAdSetId = data.adset_id;
    if (data.ad_id) leadInfo.fbAdId = data.ad_id;
    if (data.form_id) leadInfo.fbFormId = data.form_id;

    // 🎯 NOUVEAU : Récupérer les noms de campagne/formulaire (en parallèle pour optimiser)
    console.log(`[FacebookWebhook] 📡 Enrichissement : récupération noms campagne/formulaire...`);
    const [campaignName, formName] = await Promise.all([
      data.campaign_id ? fetchCampaignName(data.campaign_id) : Promise.resolve(null),
      data.form_id ? fetchFormName(data.form_id) : Promise.resolve(null),
    ]);

    if (campaignName) {
      leadInfo.fbCampaignName = campaignName;
      console.log(`[FacebookWebhook] 🎯 Campagne: "${campaignName}"`);
    }
    if (formName) {
      leadInfo.fbFormName = formName;
      console.log(`[FacebookWebhook] 📝 Formulaire: "${formName}"`);
    }

    // Vérifier champs minimum : le téléphone est obligatoire pour contacter le lead
    if (!leadInfo.mobile) {
      console.error(`[FacebookWebhook] ❌ Lead ${leadgenId} incomplet (téléphone manquant)`);
      return null;
    }
    // Fallbacks nom si manquant
    if (!leadInfo.firstName) leadInfo.firstName = "-";
    if (!leadInfo.lastName) leadInfo.lastName = leadInfo.firstName;

    return leadInfo;

  } catch (error) {
    console.error(`[FacebookWebhook] ❌ Erreur fetch lead ${leadgenId}:`, error);
    return null;
  }
}
