// Lead Scoring Algorithm - MyCRM
// Score automatique 0-100 pts pour prioriser les leads
// V2 : scoring évolutif avec progression basée sur statusCall/statusRDV

import { Client } from "@prisma/client";

interface LeadScore {
  total: number;
  details: {
    progression: number;  // 50 pts - Le plus important
    foyer: number;        // 20 pts - Profil logement
    source: number;       // 10 pts - Origine lead
    zone: number;         // 10 pts - Géographie
    contact: number;      // 5 pts - Qualité coordonnées
    budget: number;       // 5 pts - Capacité financière
  };
  priority: "TRÈS HAUTE" | "HAUTE" | "MOYENNE" | "BASSE";
  color: string;
}

/**
 * Calculer score d un lead
 * LOGIQUE V4 :
 * - Locataire → 0 pts (impossible d'installer)
 * - Hors zone (pas 13/30/83/84) → MAX 10 pts
 * - Statut propriétaire inconnu → MAX 5 pts
 * - Propriétaire en zone cible → 0-100 pts (normal)
 */
export function calculateLeadScore(client: Partial<Client>): LeadScore {
  const details = {
    progression: Math.min(scoreProgression(client), 50),  // 50% du score
    foyer: Math.min(scoreFoyer(client), 20),              // 20%
    source: Math.min(scoreSource(client), 10),            // 10%
    zone: Math.min(scoreZone(client), 10),                // 10%
    contact: Math.min(scoreContact(client), 5),           // 5%
    budget: Math.min(scoreBudget(client), 5),             // 5%
  };

  const rawTotal = Object.values(details).reduce((sum, score) => sum + score, 0);

  // ─── LOGIQUE SIMPLIFIEE : "Proprio maison ?" ───
  // Oui = score normal
  // Tout le reste (Non, vide, Locataire, etc.) = 0
  const ownerNorm = (client.isOwner || "").trim().toUpperCase();
  const isProprio = ownerNorm === "OUI";

  if (!isProprio) {
    return { total: 0, details, priority: "BASSE" as const, color: "#dc2626" };
  }

  // 🚨 HORS ZONE (si ALLOWED_DEPARTMENTS configuré) = 10 PTS MAX
  // Par défaut (vide), toutes les zones sont acceptées (white-label générique)
  const allowedDepts = (process.env.ALLOWED_DEPARTMENTS || "")
    .split(",")
    .map(d => d.trim())
    .filter(d => d);
  const zipCode = client.zipCode || "";
  const isRestricted = allowedDepts.length > 0;
  const isZoneOK = !isRestricted || allowedDepts.some(z => zipCode.startsWith(z));

  if (isRestricted && !isZoneOK && zipCode) {
    return {
      total: Math.min(rawTotal, 10),  // Limité si hors zone configurée
      details,
      priority: "BASSE",
      color: "#dc2626",  // ROUGE
    };
  }

  // 🚨 NUMÉRO ÉTRANGER (non-français) = 10 PTS MAX
  const mobileRaw = ((client.mobile as string) || '').replace(/\s/g, '');
  if (mobileRaw && mobileRaw.startsWith('+') && !mobileRaw.startsWith('+33')) {
    return {
      total: Math.min(rawTotal, 10),
      details,
      priority: "BASSE",
      color: "#dc2626",  // ROUGE
    };
  }

  // Score normal pour propriétaires en zone cible
  const total = Math.min(Math.max(rawTotal, 0), 100);

  let priority: LeadScore["priority"];
  let color: string;

  if (total >= 75) {
    priority = "TRÈS HAUTE";
    color = "#16a34a";  // VERT FONCÉ
  } else if (total >= 50) {
    priority = "HAUTE";
    color = "#65a30d";  // VERT CLAIR
  } else if (total >= 30) {
    priority = "MOYENNE";
    color = "#ea580c";  // ORANGE
  } else {
    priority = "BASSE";
    color = "#dc2626";  // ROUGE
  }

  return { total, details, priority, color };
}

/**
 * Score progression pipeline (0-50 pts) - NOUVELLE ÉCHELLE
 * Basé sur le MAX entre statusCall et statusRDV
 *
 * Progression = 50% du score total (critère le plus important pour Facebook)
 */
function scoreProgression(client: Partial<Client>): number {
  const progressionMap: Record<string, number> = {
    // Phase téléprospection (statusCall)
    "NEW": 0,                           // Nouveau lead non qualifié
    "À QUALIFIER": 5,                   // En cours de qualification
    "A QUALIFIER": 5,
    "NRP": 10,                          // Ne répond pas (à rappeler)
    "A RAPPELER": 10,
    "REINSCRIT": 10,                    // Lead réinscrit (même niveau que NRP)
    "RDV SMS CONFIRMATION NRP 1": 15,   // SMS envoyé, entre NRP et intéressé
    "INTERESSE": 20,                    // Lead intéressé
    "INTÉRESSÉ": 20,
    "A REPLACER": 25,                   // À replacer chez un commercial
    "RDV PRIS": 30,                     // 🎯 CONVERSION LEAD (événement Facebook)

    // Phase commerciale terrain (statusRDV)
    "RDV CONFIRMÉ": 35,                 // RDV confirmé par commercial
    "RDV CONFIRME": 35,
    "À RETRAVAILLER": 40,
    "A RETRAVAILLER": 40,                  // Dossier en cours
    "A TRAVAILLE": 40,
    "À REPLACER": 25,                   // À replacer (statusRDV)
    "CQ NÉGATIF": 42,
    "CQ NEGATIF": 42,
    "CQ FAIT": 45,                      // Contrôle qualité OK
    "VALIDATION FINANCEMENT": 46,
    "VALIDATION FINANCEMENT PROJEXIO": 46,
    "VALIDATION FINANCEMENT SOFINCO": 46,
    "SIGNÉ": 48,                        // Contrat signé
    "SIGNE": 48,
    "SIGNÉ COMPLET": 48,
    "SIGNE COMPLET": 48,
    "SIGNÉ INCOMPLET": 47,
    "SIGNÉ PAIEMENT COMPTANT": 48,
    "VT PROGRAMMÉ": 47,
    "VT PROGRAMME": 47,
    "ENVOI SOLARENOV": 49,
    "ENVOI EN POSE": 49,
    "POSE PROGRAMMÉ SOLARENOV": 49,
    "POSE PROGRAMME": 49,
    "POSÉ": 50,
    "POSE": 50,
    "POSÉ SOLARENOV": 50,
    "PAYÉ": 100,
    "PAYE": 100,
    "INSTALLATION RÉALISÉE": 50,        // 🎯 CONVERSION FINALE (événement Facebook)
    "INSTALLATION REALISEE": 50,
    "INSTALLATION RÉALISÉ": 50,
    "DÉSINSTALLÉ": 30,
    "DESINSTALLE": 30,
    "PORTE CLIENT": 40,
    "ANNULÉ": 35,
    "ANNULE": 35,
    "PAS SIGNÉ": 35,
    "PAS SIGNE": 35,
    "RÉTRACTATION": 35,
    "RETRACTATION": 35,
  };

  const statusCall = (client.statusCall || "").toUpperCase().trim();
  const statusRDV = (client.statusRDV || "").toUpperCase().trim();

  const callScore = progressionMap[statusCall] ?? 0;
  const rdvScore = progressionMap[statusRDV] ?? 0;

  return Math.max(callScore, rdvScore);
}

/**
 * Score selon source du lead (0-10 pts)
 * Réduit car la progression est plus importante
 */
function scoreSource(client: Partial<Client>): number {
  const campaign = client.campaign?.toLowerCase() || "";

  if (campaign.includes("referent") || campaign.includes("bouche")) return 10;  // Meilleure source
  if (campaign.includes("google") || campaign.includes("adwords")) return 9;
  if (campaign.includes("facebook") || client.fbLeadId) return 8;
  if (campaign.includes("landing") || campaign.includes("devis-solaire")) return 7;

  return 5;  // Source inconnue
}

/**
 * Score selon budget apparent (0-5 pts)
 * NOUVELLE LOGIQUE : Additionner les critères (au lieu de return successifs)
 */
function scoreBudget(client: Partial<Client>): number {
  let score = 0;

  // Montant du devis (0-3 pts)
  const totalAmount = parseFloat(client.totalAmount as string) || 0;
  if (totalAmount >= 20000) score += 3;
  else if (totalAmount >= 12000) score += 2;
  else if (totalAmount >= 8000) score += 1;

  // Facture électricité (0-2 pts)
  const electricBill = parseFloat(client.electricBill as string) || 0;
  if (electricBill >= 200) score += 2;
  else if (electricBill >= 150) score += 1;

  // Revenus foyer (0-2 pts)
  const income = parseFloat(client.householdIncome as string) || 0;
  if (income >= 5000) score += 2;
  else if (income >= 3000) score += 1;

  // Si aucune info budget mais propriétaire → bonus minimal
  if (score === 0 && client.isOwner === "Oui") score = 2;

  return Math.min(score, 5);  // Max 5 pts
}

/**
 * Score selon zone géographique (0-10 pts)
 */
function scoreZone(client: Partial<Client>): number {
  const zipCode = client.zipCode || "";

  // ZONES CIBLES depuis ALLOWED_DEPARTMENTS (env ou Setting)
  // Par défaut (vide), score 10 pour toute zone France
  const allowedDepts = (process.env.ALLOWED_DEPARTMENTS || "")
    .split(",")
    .map(d => d.trim())
    .filter(d => d);

  if (allowedDepts.length === 0) {
    // Pas de restriction - toute la France = 10pts
    return zipCode ? 10 : 3;
  }

  // Scoring par priorité dans les zones configurées
  if (zipCode.startsWith(allowedDepts[0])) return 10;
  if (allowedDepts.length > 1 && zipCode.startsWith(allowedDepts[1])) return 9;
  if (allowedDepts.length > 2 && zipCode.startsWith(allowedDepts[2])) return 8;
  if (allowedDepts.length > 3 && zipCode.startsWith(allowedDepts[3])) return 7;

  // Hors zone configurée
  return 5;
}

/**
 * Score selon qualité contact (0-5 pts)
 * Réduit car quasiment tous les leads Facebook ont mobile+email
 */
function scoreContact(client: Partial<Client>): number {
  let score = 0;

  // Téléphone (0-2 pts)
  if (client.mobile) score += 2;
  else if (client.phone1) score += 1;

  // Email (0-2 pts)
  if (client.email && client.email.includes("@")) score += 2;

  // Adresse complète (0-1 pt)
  if (client.address && client.zipCode && client.city) score += 1;

  return Math.min(score, 5);
}

/**
 * Score selon profil foyer (0-20 pts)
 * Propriétaire = +12 pts (critère absolu)
 * Locataire géré en amont (score forcé à 0)
 */
function scoreFoyer(client: Partial<Client>): number {
  let score = 0;

  // Statut propriétaire (0-12 pts) - CRITÈRE #1 ABSOLU
  const ownerUp = (client.isOwner || "").trim().toUpperCase();
  if (ownerUp === "OUI") {
    score += 12;
  } else if (client.ownerSince) {
    const years = parseInt(client.ownerSince as string) || 0;
    if (years >= 5) score += 10;
    else if (years >= 2) score += 6;
  }

  // Surface (0-4 pts)
  const surface = parseFloat(client.surface as string) || 0;
  if (surface >= 150) score += 4;
  else if (surface >= 100) score += 3;
  else if (surface >= 80) score += 2;

  // Équipements énergivores (0-2 pts)
  if (client.pool) score += 1;
  if (client.electricCar) score += 1;

  // Orientation toit (0-2 pts)
  if (client.roofOrientation?.includes("Sud")) score += 2;
  else if (client.roofOrientation?.includes("Est") || client.roofOrientation?.includes("Ouest")) score += 1;

  // Espace toit disponible et pas en zone ABF (0-2 pts)
  if (client.roofSpace && !client.zoneABF) score += 2;

  return Math.min(score, 20);  // Max 20 pts
}

// Timing et Engagement supprimés : redondants avec Progression (50 pts)

/**
 * Calculer score pour un batch de leads
 */
export function scoreBatchLeads(clients: Partial<Client>[]): Map<number, LeadScore> {
  const scores = new Map<number, LeadScore>();

  for (const client of clients) {
    if (client.id) {
      scores.set(client.id, calculateLeadScore(client));
    }
  }

  return scores;
}

/**
 * Obtenir seuils de priorité
 */
export const PRIORITY_THRESHOLDS = {
  VERY_HIGH: 75,
  HIGH: 50,
  MEDIUM: 30,
  LOW: 0,
} as const;

/**
 * Obtenir description du score
 */
export function getScoreDescription(score: number): string {
  if (score >= 75) {
    return "🔥 Lead ultra-qualifié - À contacter en priorité absolue";
  } else if (score >= 50) {
    return "⭐ Lead qualifié - Forte probabilité de conversion";
  } else if (score >= 30) {
    return "📞 Lead standard - Qualification nécessaire";
  } else {
    return "💤 Lead froid - Relance différée ou nurturing";
  }
}
