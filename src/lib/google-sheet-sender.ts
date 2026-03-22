/**
 * 📊 ENVOI AUTOMATIQUE VERS GOOGLE SHEET
 *
 * Envoie chaque nouveau lead vers le Google Sheet en temps réel
 * Structure: 6 colonnes (full name, phone, email, postcode, proprietaire, surface)
 */

import { google } from 'googleapis';

export interface LeadData {
  firstName: string;
  lastName: string;
  mobile?: string;
  email?: string;
  zipCode?: string;
  isOwner?: string;
  houseSurface?: string;
  source?: string;
}

/**
 * Envoyer un lead vers le Google Sheet
 */
export async function sendToGoogleSheet(lead: LeadData): Promise<boolean> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const credentialsBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!sheetId) {
    console.log('[GoogleSheet] ⚠️  GOOGLE_SHEET_ID non configuré');
    return false;
  }

  if (!credentialsBase64) {
    console.log('[GoogleSheet] ⚠️  GOOGLE_SERVICE_ACCOUNT_JSON non configuré');
    console.log('[GoogleSheet] 📋 M doit créer Service Account Google et fournir credentials JSON en base64');
    return false;
  }

  try {
    console.log(`[GoogleSheet] 📊 Envoi vers Google Sheet...`);

    // Déchiffrer credentials
    const credentialsJson = Buffer.from(credentialsBase64, 'base64').toString();
    const credentials = JSON.parse(credentialsJson);

    // Authentification Google
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Préparer données selon structure exacte de M (6 colonnes)
    const fullName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim();
    const phoneNumber = lead.mobile || '';
    const email = lead.email || '';
    const postcode = lead.zipCode || '';
    const isOwner = lead.isOwner || 'Non renseigné';
    const surface = lead.houseSurface || 'Non renseigné';

    const values = [[
      fullName,          // A: full name
      phoneNumber,       // B: phone number
      email,             // C: email
      postcode,          // D: postcode
      isOwner,           // E: Etes-vous proprietaire d'une maison individuelle?
      surface,           // F: Surface de la maison (m2)?
    ]];

    // Envoyer vers Google Sheet (Feuille 1)
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Feuille 1!A:F', // 6 colonnes dans "Feuille 1"
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    console.log('[GoogleSheet] ✅ Lead envoyé avec succès:', fullName);
    return true;

  } catch (error: any) {
    console.error('[GoogleSheet] ❌ Erreur:', error.message);
    return false;
  }
}

/**
 * Vérifier si Google Sheet est configuré
 */
export function isGoogleSheetConfigured(): boolean {
  return !!(process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
}
