/**
 * 📱 WHATSAPP BUSINESS - MODULE UNIFIÉ
 *
 * Toutes les fonctions WhatsApp en un seul fichier :
 * - Liens wa.me pré-remplis
 * - Envoi de messages texte via Cloud API
 * - Envoi de templates via Cloud API
 * - Notifications à M (propriétaire) via Twilio
 */

const WHATSAPP_BUSINESS_NUMBER = process.env.WHATSAPP_BUSINESS_NUMBER || "";
const WHATSAPP_API_VERSION = "v22.0";
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || "";

export interface WhatsAppRecipient {
  name: string;
  number: string;
}

// WHATSAPP_RECIPIENTS configuré via env: WHATSAPP_NOTIF_RECIPIENTS="name1:+33612345678,name2:+972548358765"
export function getWhatsAppRecipients(): WhatsAppRecipient[] {
  const envVal = process.env.WHATSAPP_NOTIF_RECIPIENTS;
  if (!envVal) return [];
  return envVal.split(",").map(entry => {
    const [name, number] = entry.split(":");
    return { name: name.trim(), number: number.trim() };
  });
}

// ===== HELPERS =====

/**
 * Nettoie un numéro de téléphone pour WhatsApp (format international sans +)
 */
function cleanPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, "");
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    cleaned = "33" + cleaned.substring(1);
  }
  if (cleaned.length === 9) {
    cleaned = "33" + cleaned;
  }
  return cleaned;
}

/**
 * Vérifie si un numéro est un mobile (peut recevoir WhatsApp)
 */
export function isMobileNumber(phone: string): boolean {
  const cleaned = phone.replace(/[^0-9]/g, "");
  if (cleaned.startsWith("06") || cleaned.startsWith("07")) return true;
  if (cleaned.startsWith("336") || cleaned.startsWith("337")) return true;
  return false;
}

// ===== LIENS WA.ME =====

/**
 * Génère un lien wa.me pour envoyer un message WhatsApp
 */
export function generateWhatsAppLink(clientPhone: string, message: string): string {
  const cleanedPhone = cleanPhoneNumber(clientPhone);
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanedPhone}?text=${encodedMessage}`;
}

/**
 * Génère le message de bienvenue WhatsApp pour un nouveau lead
 */
export function getWelcomeMessage(firstName: string): string {
  const product = process.env.LANDING_PRODUCT || "nos services";
  return `Bonjour ${firstName}, suite à votre demande concernant ${product}, notre conseiller va vous contacter prochainement.`;
}

/**
 * Génère un lien WhatsApp de bienvenue pour un client
 */
export function getWelcomeWhatsAppLink(clientPhone: string, firstName: string): string {
  const message = getWelcomeMessage(firstName);
  return generateWhatsAppLink(clientPhone, message);
}

// ===== WHATSAPP CLOUD API =====

/**
 * Envoyer un message texte libre via WhatsApp Cloud API
 */
export async function sendWhatsAppText(to: string, body: string): Promise<boolean> {
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    console.log("[WhatsApp] ⚠️  Cloud API non configurée (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN manquants)");
    return false;
  }

  const cleanedTo = cleanPhoneNumber(to);

  try {
    const response = await fetch(
      `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleanedTo,
          type: "text",
          text: { body },
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      console.log(`[WhatsApp] ✅ Message texte envoyé à ${cleanedTo} (ID: ${data.messages?.[0]?.id})`);
      return true;
    } else {
      const error = await response.text();
      console.error(`[WhatsApp] ❌ Échec envoi texte à ${cleanedTo}:`, error);
      return false;
    }
  } catch (error: unknown) {
    console.error("[WhatsApp] ❌ Erreur envoi texte:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Envoyer un template WhatsApp (avec composants optionnels)
 */
interface WhatsAppTemplateComponent {
  type: string;
  [key: string]: unknown;
}

export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode: string = "fr",
  components?: WhatsAppTemplateComponent[]
): Promise<boolean> {
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    console.log("[WhatsApp] ⚠️  Cloud API non configurée");
    return false;
  }

  const cleanedTo = cleanPhoneNumber(to);

  try {
    const templatePayload: WhatsAppTemplateComponent = {
      name: templateName,
      language: { code: languageCode },
    };

    if (components && components.length > 0) {
      templatePayload.components = components;
    }

    const response = await fetch(
      `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleanedTo,
          type: "template",
          template: templatePayload,
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      console.log(`[WhatsApp] ✅ Template "${templateName}" envoyé à ${cleanedTo} (ID: ${data.messages?.[0]?.id})`);
      return true;
    } else {
      const error = await response.text();
      console.error(`[WhatsApp] ❌ Échec template "${templateName}" à ${cleanedTo}:`, error);
      return false;
    }
  } catch (error: unknown) {
    console.error("[WhatsApp] ❌ Erreur envoi template:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Envoyer un template WhatsApp avec paramètres body
 * Raccourci pour les templates avec variables
 */
export async function sendWhatsAppTemplateWithParams(
  to: string,
  templateName: string,
  bodyParams: string[],
  languageCode: string = "fr"
): Promise<boolean> {
  const components = [
    {
      type: "body",
      parameters: bodyParams.map((text) => ({ type: "text", text })),
    },
  ];
  return sendWhatsAppTemplate(to, templateName, languageCode, components);
}

// ===== NOTIFICATIONS À M (TWILIO) =====

interface LeadNotification {
  firstName: string;
  lastName: string;
  mobile?: string;
  email?: string;
  city?: string;
  zipCode?: string;
  priority: string;
  score: number;
  source: string;
  clientId: number;
}

/**
 * Envoyer notification WhatsApp via Twilio à M (propriétaire)
 */
export async function sendWhatsAppNotificationToM(lead: LeadNotification): Promise<boolean> {
  const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
  const CRM_BASE_URL = process.env.CRM_BASE_URL || "https://mycrm.solar";

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.log("[WhatsApp M] ⚠️  Twilio non configuré - notifications WhatsApp désactivées");
    return false;
  }

  const priorityEmoji: Record<string, string> = {
    "TRÈS HAUTE": "🔥",
    "HAUTE": "⭐",
    "MOYENNE": "📞",
    "BASSE": "💤",
  };

  const emoji = priorityEmoji[lead.priority] || "📋";

  const message = `${emoji} *NOUVEAU LEAD ${lead.priority}*

👤 ${lead.firstName} ${lead.lastName}
📞 ${lead.mobile || "Non renseigné"}
📧 ${lead.email || "Non renseigné"}
📍 ${lead.zipCode || ""} ${lead.city || ""}

📊 Score: ${lead.score}/100 pts
📋 Source: ${lead.source}

🔗 Voir: ${CRM_BASE_URL}/clients?openClient=${lead.clientId}`;

  let successCount = 0;

  for (const recipient of getWhatsAppRecipients()) {
    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64"),
          },
          body: new URLSearchParams({
            From: TWILIO_WHATSAPP_FROM,
            To: `whatsapp:${recipient.number}`,
            Body: message,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log(`[WhatsApp M] ✅ Envoyé à ${recipient.name} (SID: ${data.sid})`);
        successCount++;
      } else {
        const error = await response.text();
        console.error(`[WhatsApp M] ❌ Échec ${recipient.name}:`, error);
      }
    } catch (error: unknown) {
      console.error(`[WhatsApp M] ❌ Erreur ${recipient.name}:`, error instanceof Error ? error.message : error);
    }
  }

  return successCount > 0;
}

export { WHATSAPP_BUSINESS_NUMBER };
