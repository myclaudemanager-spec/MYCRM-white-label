// ─── Status constants used across the CRM ────────────────────────────────────

// Auto-freeze when statusCall changes to one of these
export const FREEZE_STATUSES = ["RDV PRIS", "RDV CONFIRMÉ"];

// Auto-unfreeze when statusCall changes to one of these
export const TERMINAL_STATUSES = [
  "PAS INTERESSE", "PAS ELIGIBLE", "INFINANÇABLE",
  "RÉTRACTATION", "FAUX NUM", "FAUX NUMERO", "HORS ZONE",
];

// CAPI Purchase — all SIGNÉ variants (compared after .toUpperCase())
export const SIGNE_VARIANTS = [
  "SIGNÉ", "SIGNE", "SIGNÉ COMPLET", "SIGNE COMPLET",
  "SIGNÉ INCOMPLET", "SIGNÉ PAIEMENT COMPTANT",
];

// CAPI Installation — all POSÉ variants (compared after .toUpperCase())
export const POSE_VARIANTS = [
  "POSÉ", "POSE", "POSÉ SOLARENOV", "POSE SOLARENOV",
  "INSTALLATION RÉALISÉE", "INSTALLATION REALISEE",
];

// CAPI Payment (compared after .toUpperCase())
export const PAYE_VARIANTS = ["PAYÉ", "PAYE", "PAYÉE", "PAYEE"];

// ─── isOwner normalization (safety net for legacy values) ────────────────────

export const OWNER_YES = new Set(["Oui", "Proprietaire", "Propriétaire"]);
export const OWNER_NO = new Set(["Non", "Non éligible", "Locataire", "Appartement", "Autre"]);

// ─── Type casting config (Prisma is strict, frontend sends strings) ──────────

export const INT_FIELDS = new Set(["currentCredit"]);
export const FLOAT_FIELDS = new Set(["invoiceHT", "invoiceTTC", "commissionHT", "commissionTTC", "commissionTelepos"]);
export const BOOL_FIELDS = new Set(["pool", "electricCar", "zoneABF"]);
