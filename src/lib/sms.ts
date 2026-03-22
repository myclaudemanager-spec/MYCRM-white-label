// SMS Service - Twilio/Vonage/etc.
// Pour confirmation RDV et rappels automatiques

/**
 * Configuration SMS
 *
 * Ajouter dans .env :
 * SMS_PROVIDER="twilio" # ou "vonage", "aws-sns"
 * SMS_ACCOUNT_SID="AC..." # Twilio Account SID
 * SMS_AUTH_TOKEN="..." # Twilio Auth Token
 * SMS_FROM_NUMBER="+33612345678" # Numéro expéditeur
 * SMS_COMPANY_NAME="Nom de la société" # Nom utilisé dans les messages
 * SMS_REPLY_PHONE="0600000000" # Numéro de téléphone pour les rappels
 */

const SMS_PROVIDER = process.env.SMS_PROVIDER || "disabled";
const SMS_ACCOUNT_SID = process.env.SMS_ACCOUNT_SID;
const SMS_AUTH_TOKEN = process.env.SMS_AUTH_TOKEN;
const SMS_FROM = process.env.SMS_FROM_NUMBER || "+33612345678";
const SMS_COMPANY_NAME = process.env.SMS_COMPANY_NAME || "Notre entreprise";
const SMS_REPLY_PHONE = process.env.SMS_REPLY_PHONE || "0600000000";

interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Envoyer un SMS via Twilio
 */
async function sendViaTwilio(to: string, message: string): Promise<SMSResult> {
  if (!SMS_ACCOUNT_SID || !SMS_AUTH_TOKEN) {
    return {
      success: false,
      error: "Twilio credentials manquantes (SMS_ACCOUNT_SID, SMS_AUTH_TOKEN)",
    };
  }

  try {
    // Import dynamique (optionnel si Twilio installé)
    const twilio = require("twilio");
    const client = twilio(SMS_ACCOUNT_SID, SMS_AUTH_TOKEN);

    const result = await client.messages.create({
      body: message,
      from: SMS_FROM,
      to: to,
    });

    return {
      success: true,
      messageId: result.sid,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error("❌ Erreur Twilio SMS:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Envoyer SMS générique
 */
export async function sendSMS(to: string, message: string): Promise<SMSResult> {
  // Validation téléphone
  const cleanPhone = to.replace(/\s/g, "");
  if (!/^(\+33|0)[67]\d{8}$/.test(cleanPhone)) {
    return {
      success: false,
      error: `Numéro invalide: ${to}`,
    };
  }

  // Formater avec +33
  let formattedPhone = cleanPhone;
  if (cleanPhone.startsWith("0")) {
    formattedPhone = "+33" + cleanPhone.substring(1);
  }

  console.log(`📱 Envoi SMS à ${formattedPhone}`);

  // Provider désactivé = mode simulation
  if (SMS_PROVIDER === "disabled") {
    console.log(`   ⚠️  Mode simulation (SMS_PROVIDER=disabled)`);
    console.log(`   Message: ${message.substring(0, 100)}...`);
    return {
      success: true,
      messageId: `sim_${Date.now()}`,
    };
  }

  // Provider Twilio
  if (SMS_PROVIDER === "twilio") {
    return sendViaTwilio(formattedPhone, message);
  }

  // Provider non supporté
  return {
    success: false,
    error: `Provider ${SMS_PROVIDER} non supporté`,
  };
}

/**
 * SMS: Confirmation RDV immédiate
 */
export async function sendRDVConfirmation(client: {
  firstName?: string | null;
  mobile?: string | null;
  phone1?: string | null;
  rdvDate?: string | null;
  rdvTime?: string | null;
}) {
  const phone = client.mobile || client.phone1;
  if (!phone) {
    console.log(`⚠️  Client sans téléphone, SMS impossible`);
    return { success: false, error: "Pas de téléphone" };
  }

  const prenom = client.firstName || "Monsieur/Madame";
  const dateRDV = client.rdvDate || "[date à confirmer]";
  const heureRDV = client.rdvTime || "[heure à confirmer]";

  const message = `✅ Bonjour ${prenom}, votre RDV avec ${SMS_COMPANY_NAME} est confirmé le ${dateRDV} à ${heureRDV}. Nous vous rappellerons 24h avant. En cas d'imprévu, appelez-nous au ${SMS_REPLY_PHONE}.`;

  return sendSMS(phone, message);
}

/**
 * SMS: Rappel 24h avant RDV
 */
export async function sendRDV24HReminder(client: {
  firstName?: string | null;
  mobile?: string | null;
  phone1?: string | null;
  rdvDate?: string | null;
  rdvTime?: string | null;
}) {
  const phone = client.mobile || client.phone1;
  if (!phone) {
    return { success: false, error: "Pas de téléphone" };
  }

  const prenom = client.firstName || "Monsieur/Madame";
  const dateRDV = client.rdvDate || "[date]";
  const heureRDV = client.rdvTime || "[heure]";

  const message = `⏰ Rappel : RDV demain ${dateRDV} à ${heureRDV} avec ${SMS_COMPANY_NAME}. Merci de confirmer votre présence en répondant OUI. Besoin de reporter ? Appelez ${SMS_REPLY_PHONE}`;

  return sendSMS(phone, message);
}

/**
 * SMS: Rappel 2h avant RDV
 */
export async function sendRDV2HReminder(client: {
  firstName?: string | null;
  mobile?: string | null;
  phone1?: string | null;
  rdvTime?: string | null;
}) {
  const phone = client.mobile || client.phone1;
  if (!phone) {
    return { success: false, error: "Pas de téléphone" };
  }

  const prenom = client.firstName || "Monsieur/Madame";
  const heureRDV = client.rdvTime || "[heure]";

  const message = `🚗 Bonjour ${prenom}, notre expert arrive pour votre RDV à ${heureRDV}. À tout de suite !`;

  return sendSMS(phone, message);
}

/**
 * SMS: RDV annulé/reporté
 */
export async function sendRDVCancelled(
  client: {
    firstName?: string | null;
    mobile?: string | null;
    phone1?: string | null;
  },
  reason: "cancel" | "postpone"
) {
  const phone = client.mobile || client.phone1;
  if (!phone) {
    return { success: false, error: "Pas de téléphone" };
  }

  const prenom = client.firstName || "Monsieur/Madame";

  let message = "";
  if (reason === "cancel") {
    message = `❌ Bonjour ${prenom}, votre RDV avec ${SMS_COMPANY_NAME} a été annulé. Pour reprendre contact, appelez-nous au ${SMS_REPLY_PHONE}.`;
  } else {
    message = `📅 Bonjour ${prenom}, votre RDV avec ${SMS_COMPANY_NAME} doit être reporté. Nous vous recontactons rapidement pour fixer une nouvelle date. Merci de votre compréhension.`;
  }

  return sendSMS(phone, message);
}
