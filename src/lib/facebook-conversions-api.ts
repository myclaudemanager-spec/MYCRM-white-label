// Facebook Conversions API - Server-side tracking
// Pour envoyer des événements Pixel depuis le serveur

const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID;
const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

export async function trackServerSideEvent(
  eventName: string,
  clientData: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    city?: string;
    zipCode?: string;
    fbLeadId?: string; // Facebook Lead ID pour matching
  },
  customData?: Record<string, any>
) {
  if (!FB_PIXEL_ID || !FB_ACCESS_TOKEN) {
    console.error("❌ Facebook Pixel ID ou Access Token manquant");
    return false;
  }

  try {
    const eventTime = Math.floor(Date.now() / 1000);

    // Hasher les données utilisateur (Facebook exige SHA256)
    const crypto = require("crypto");
    const hash = (value: string | undefined) => {
      if (!value) return undefined;
      return crypto.createHash("sha256").update(value.toLowerCase().trim()).digest("hex");
    };

    const userData: any = {};
    if (clientData.email) userData.em = [hash(clientData.email)]; // Array format pour FB
    if (clientData.phone) userData.ph = [hash(clientData.phone?.replace(/\D/g, ""))]; // Array format
    if (clientData.firstName) userData.fn = [hash(clientData.firstName)];
    if (clientData.lastName) userData.ln = [hash(clientData.lastName)];
    if (clientData.city) userData.ct = [hash(clientData.city)];
    if (clientData.zipCode) userData.zp = [hash(clientData.zipCode)];

    // ⚠️ CRITIQUE : lead_id = Facebook Lead ID (priorité HIGHEST pour matching)
    if (clientData.fbLeadId) {
      userData.lead_id = clientData.fbLeadId; // Non hashé, format original
    }

    // Extract event_id for dedup if provided in customData
    const eventId = customData?.event_id;
    const cleanCustomData = { ...customData };
    if (cleanCustomData.event_id) delete cleanCustomData.event_id;

    // ⚠️ OBLIGATOIRE : lead_event_source = nom du CRM (requis par Facebook)
    if (!cleanCustomData.lead_event_source) {
      cleanCustomData.lead_event_source = "MyCRM"; // Nom de ton CRM
    }
    if (!cleanCustomData.event_source) {
      cleanCustomData.event_source = "crm"; // Toujours "crm"
    }

    // Determine action_source: system_generated for all CRM events
    const actionSource = "system_generated"; // Toujours system_generated pour CRM

    const payload = {
      data: [
        {
          event_name: eventName,
          event_time: eventTime,
          action_source: actionSource,
          event_id: eventId || `${eventName}_${eventTime}`,
          user_data: userData,
          custom_data: cleanCustomData,
        },
      ],
    };

    const url = `https://graph.facebook.com/v22.0/${FB_PIXEL_ID}/events?access_token=${FB_ACCESS_TOKEN}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (result.error) {
      console.error("❌ Erreur Conversions API:", result.error);
      return false;
    }

    console.log(`✅ Événement ${eventName} envoyé via Conversions API`);
    return true;
  } catch (error) {
    console.error("❌ Erreur trackServerSideEvent:", error);
    return false;
  }
}

// Helper pour Lead event
export async function trackLead(
  client: {
    email?: string;
    mobile?: string;
    firstName?: string;
    lastName?: string;
    city?: string;
    zipCode?: string;
    id: number;
    fbLeadId?: string | null; // Facebook Lead ID pour matching
  },
  leadScore?: number,
  leadPriority?: string
) {
  // Calculer la valeur basée sur le score (0-100 → 0-1.0)
  // Facebook utilise cette valeur pour optimiser les campagnes
  const value = leadScore ? leadScore / 100 : 0.5; // Défaut 0.5 si pas de score

  return trackServerSideEvent(
    "Lead",
    {
      email: client.email || undefined,
      phone: client.mobile || undefined,
      firstName: client.firstName || undefined,
      lastName: client.lastName || undefined,
      city: client.city || undefined,
      zipCode: client.zipCode || undefined,
      fbLeadId: client.fbLeadId || undefined, // Passer le FB Lead ID
    },
    {
      content_name: "Nouveau Lead",
      content_category: "CRM",
      client_id: client.id,
      value: value, // Facebook optimise pour les leads de haute valeur
      currency: "AED",
      lead_score: leadScore || 0,
      lead_priority: leadPriority || "BASSE",
      predicted_ltv: value * 1000, // Lifetime Value estimée en AED
    }
  );
}

// Helper pour Purchase event (avec valeur)
export async function trackPurchase(
  client: {
    email?: string;
    mobile?: string;
    firstName?: string;
    lastName?: string;
    fbLeadId?: string | null;
  },
  value: number
) {
  return trackServerSideEvent(
    "Purchase",
    {
      email: client.email || undefined,
      phone: client.mobile || undefined,
      firstName: client.firstName || undefined,
      lastName: client.lastName || undefined,
      fbLeadId: client.fbLeadId || undefined,
    },
    {
      content_name: "Signature",
      value: value,
      currency: "AED", // Dubai = AED, pas EUR
    }
  );
}

// Helper pour QualifiedOwner event (propriétaire maison confirmé)
export async function trackQualifiedOwner(
  client: {
    email?: string;
    mobile?: string;
    firstName?: string;
    lastName?: string;
    city?: string;
    zipCode?: string;
    id: number;
    fbLeadId?: string | null;
    fbCampaignId?: string | null;
    fbAdSetId?: string | null;
    fbAdId?: string | null;
    fbFormId?: string | null;
  },
  leadScore?: number
) {
  const eventId = client.fbLeadId ? `qualified_${client.fbLeadId}` : `qualified_${client.id}_${Date.now()}`;

  // Utiliser "Lead" (standard Facebook) au lieu de "QualifiedOwner" (custom)
  // Facebook peut optimiser sur "Lead" mais PAS sur des events custom
  return trackServerSideEvent(
    "Lead",
    {
      email: client.email || undefined,
      phone: client.mobile || undefined,
      firstName: client.firstName || undefined,
      lastName: client.lastName || undefined,
      city: client.city || undefined,
      zipCode: client.zipCode || undefined,
      fbLeadId: client.fbLeadId || undefined,
    },
    {
      content_name: "Propriétaire Qualifié",
      content_category: "qualified_owner",
      client_id: client.id,
      value: leadScore ? leadScore / 100 : 0.5,
      currency: "AED",
      lead_score: leadScore || 0,
      fb_lead_id: client.fbLeadId || undefined,
      fb_campaign_id: client.fbCampaignId || undefined,
      fb_adset_id: client.fbAdSetId || undefined,
      fb_ad_id: client.fbAdId || undefined,
      fb_form_id: client.fbFormId || undefined,
      event_id: eventId,
    }
  );
}

// Helper pour Schedule event (RDV PRIS) avec score mis à jour
export async function trackScheduleWithScore(
  client: {
    email?: string;
    mobile?: string;
    firstName?: string;
    lastName?: string;
    city?: string;
    zipCode?: string;
    id: number;
    fbLeadId?: string | null;
    fbCampaignId?: string | null;
    fbAdSetId?: string | null;
    fbAdId?: string | null;
    fbFormId?: string | null;
  },
  leadScore: number
) {
  const eventId = client.fbLeadId ? `schedule_${client.fbLeadId}` : `schedule_${client.id}_${Date.now()}`;

  return trackServerSideEvent(
    "Schedule",
    {
      email: client.email || undefined,
      phone: client.mobile || undefined,
      firstName: client.firstName || undefined,
      lastName: client.lastName || undefined,
      city: client.city || undefined,
      zipCode: client.zipCode || undefined,
      fbLeadId: client.fbLeadId || undefined, // Passer FB Lead ID pour matching
    },
    {
      content_name: "RDV Pris",
      content_category: "CRM",
      client_id: client.id,
      value: leadScore / 100, // Score mis à jour (ex: 67 pts → 0.67)
      currency: "AED",
      lead_score: leadScore,
      fb_lead_id: client.fbLeadId || undefined,
      fb_campaign_id: client.fbCampaignId || undefined,
      fb_adset_id: client.fbAdSetId || undefined,
      fb_ad_id: client.fbAdId || undefined,
      fb_form_id: client.fbFormId || undefined,
      event_id: eventId,
    }
  );
}

// Helper pour Purchase event (SIGNÉ) avec score mis à jour
export async function trackPurchaseWithScore(
  client: {
    email?: string;
    mobile?: string;
    firstName?: string;
    lastName?: string;
    city?: string;
    zipCode?: string;
    id: number;
    fbLeadId?: string | null;
    fbCampaignId?: string | null;
    fbAdSetId?: string | null;
    fbAdId?: string | null;
    fbFormId?: string | null;
  },
  leadScore: number,
  totalAmount?: number
) {
  const eventId = client.fbLeadId ? `purchase_${client.fbLeadId}` : `purchase_${client.id}_${Date.now()}`;

  // Utiliser le montant du contrat si disponible, sinon le score comme valeur
  const value = totalAmount || leadScore / 100;

  return trackServerSideEvent(
    "Purchase",
    {
      email: client.email || undefined,
      phone: client.mobile || undefined,
      firstName: client.firstName || undefined,
      lastName: client.lastName || undefined,
      city: client.city || undefined,
      zipCode: client.zipCode || undefined,
      fbLeadId: client.fbLeadId || undefined, // Passer FB Lead ID pour matching
    },
    {
      content_name: "Signature Contrat",
      content_category: "CRM",
      client_id: client.id,
      value: value, // Montant contrat ou score mis à jour
      currency: "AED",
      lead_score: leadScore,
      contract_amount: totalAmount || 0,
      fb_lead_id: client.fbLeadId || undefined,
      fb_campaign_id: client.fbCampaignId || undefined,
      fb_adset_id: client.fbAdSetId || undefined,
      fb_ad_id: client.fbAdId || undefined,
      fb_form_id: client.fbFormId || undefined,
      event_id: eventId,
    }
  );
}

// Helper pour Installation event (INSTALLATION RÉALISÉE) avec score final
export async function trackInstallationWithScore(
  client: {
    email?: string;
    mobile?: string;
    firstName?: string;
    lastName?: string;
    city?: string;
    zipCode?: string;
    id: number;
    fbLeadId?: string | null;
    fbCampaignId?: string | null;
    fbAdSetId?: string | null;
    fbAdId?: string | null;
    fbFormId?: string | null;
  },
  leadScore: number,
  totalAmount?: number
) {
  const eventId = client.fbLeadId ? `installation_${client.fbLeadId}` : `installation_${client.id}_${Date.now()}`;

  // Utiliser le montant du contrat si disponible, sinon le score comme valeur
  const value = totalAmount || leadScore / 100;

  return trackServerSideEvent(
    "CompleteRegistration", // Événement standard Facebook pour conversion finale
    {
      email: client.email || undefined,
      phone: client.mobile || undefined,
      firstName: client.firstName || undefined,
      lastName: client.lastName || undefined,
      city: client.city || undefined,
      zipCode: client.zipCode || undefined,
      fbLeadId: client.fbLeadId || undefined, // Passer FB Lead ID pour matching
    },
    {
      content_name: "Installation Réalisée",
      content_category: "CRM",
      client_id: client.id,
      value: value, // Montant final ou score final
      currency: "AED",
      lead_score: leadScore,
      contract_amount: totalAmount || 0,
      status: "completed",
      fb_lead_id: client.fbLeadId || undefined,
      fb_campaign_id: client.fbCampaignId || undefined,
      fb_adset_id: client.fbAdSetId || undefined,
      fb_ad_id: client.fbAdId || undefined,
      fb_form_id: client.fbFormId || undefined,
      event_id: eventId,
    }
  );
}

// Helper pour QualifiedLead event (lead passé qualification express)
export async function trackQualifiedLead(
  client: {
    email?: string;
    mobile?: string;
    firstName?: string;
    lastName?: string;
    city?: string;
    zipCode?: string;
    id: number;
    fbLeadId?: string | null;
    fbCampaignId?: string | null;
    fbAdSetId?: string | null;
    fbAdId?: string | null;
    fbFormId?: string | null;
  },
  leadScore: number,
  qualificationMethod: string // "QUALIFICATION_EXPRESS" ou "AUTO_SCORING"
) {
  const eventId = client.fbLeadId ? `qualified_lead_${client.fbLeadId}` : `qualified_lead_${client.id}_${Date.now()}`;

  // Utiliser "Lead" (standard Facebook) au lieu de "QualifiedLead" (custom)
  return trackServerSideEvent(
    "Lead",
    {
      email: client.email || undefined,
      phone: client.mobile || undefined,
      firstName: client.firstName || undefined,
      lastName: client.lastName || undefined,
      city: client.city || undefined,
      zipCode: client.zipCode || undefined,
      fbLeadId: client.fbLeadId || undefined,
    },
    {
      content_name: "Lead Qualifié",
      content_category: "qualified",
      client_id: client.id,
      value: leadScore / 100, // Score normalisé 0-1
      currency: "AED",
      lead_score: leadScore,
      qualification_method: qualificationMethod,
      fb_lead_id: client.fbLeadId || undefined,
      fb_campaign_id: client.fbCampaignId || undefined,
      fb_adset_id: client.fbAdSetId || undefined,
      fb_ad_id: client.fbAdId || undefined,
      fb_form_id: client.fbFormId || undefined,
      event_id: eventId,
    }
  );
}

// Helper pour DisqualifiedLead — NE PAS envoyer à Facebook
// Les events custom ne sont pas exploitables par l'algo FB, et envoyer
// un signal négatif n'apporte rien à l'optimisation des campagnes.
// On garde la fonction pour compatibilité mais elle ne fait plus rien.
export async function trackDisqualifiedLead(
  client: {
    email?: string;
    mobile?: string;
    firstName?: string;
    lastName?: string;
    city?: string;
    zipCode?: string;
    id: number;
    fbLeadId?: string | null;
    fbCampaignId?: string | null;
    fbAdSetId?: string | null;
    fbAdId?: string | null;
    fbFormId?: string | null;
  },
  reason: string
) {
  // Ne plus envoyer d'event custom "DisqualifiedLead" à Facebook
  // Facebook ne peut pas optimiser sur des events custom négatifs
  console.log(`[FB CAPI] DisqualifiedLead NON envoyé (inutile pour FB) - client ${client.id}, raison: ${reason}`);
  return true;
}
