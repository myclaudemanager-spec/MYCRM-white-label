/**
 * Service Centralisé de Gestion des Devises
 *
 * Objectif : Éliminer la duplication du taux de change hardcodé dans 4+ fichiers
 * Source unique de vérité pour conversion AED/EUR/USD
 */

// ==================== TYPES ====================

export type CurrencyCode = 'AED' | 'EUR' | 'USD';

export interface Currency {
  code: CurrencyCode;
  symbol: string;
  name: string;
}

export interface ExchangeRate {
  from: CurrencyCode;
  to: CurrencyCode;
  rate: number;
}

// ==================== CONSTANTES ====================

/**
 * Devises supportées
 */
export const CURRENCIES: Record<CurrencyCode, Currency> = {
  AED: {
    code: 'AED',
    symbol: 'د.إ',
    name: 'Dirham Émirati',
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
  },
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'Dollar US',
  },
};

/**
 * Taux de change fixes
 *
 * ⚠️ SOURCE UNIQUE DE VÉRITÉ
 *
 * Contexte : Compte Facebook Ads à Dubai (AED)
 * 1 AED ≈ 0.25 EUR (4 AED ≈ 1 EUR)
 */
export const EXCHANGE_RATES = {
  // AED conversions
  AED_TO_EUR: 0.25,
  AED_TO_USD: 0.27,

  // EUR conversions
  EUR_TO_AED: 4.0,
  EUR_TO_USD: 1.08,

  // USD conversions
  USD_TO_AED: 3.67,
  USD_TO_EUR: 0.93,
};

/**
 * Devise par défaut (peut être configurée via .env)
 */
export const DEFAULT_CURRENCY: CurrencyCode =
  (process.env.DEFAULT_CURRENCY as CurrencyCode) || 'AED';

/**
 * Devise secondaire pour conversion (peut être configurée via .env)
 */
export const SECONDARY_CURRENCY: CurrencyCode =
  (process.env.SECONDARY_CURRENCY as CurrencyCode) || 'EUR';

// ==================== FONCTIONS PRINCIPALES ====================

/**
 * Convertir un montant d'une devise à une autre
 *
 * @param amount Montant à convertir
 * @param from Devise source
 * @param to Devise cible
 * @returns Montant converti
 *
 * @example
 * convertCurrency(1000, 'AED', 'EUR') // 250
 * convertCurrency(250, 'EUR', 'AED') // 1000
 */
export function convertCurrency(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode
): number {
  // Cas identique : pas de conversion
  if (from === to) {
    return amount;
  }

  // Construire la clé du taux de change
  const rateKey = `${from}_TO_${to}` as keyof typeof EXCHANGE_RATES;

  // Récupérer le taux
  const rate = EXCHANGE_RATES[rateKey];

  if (!rate) {
    console.warn(`Taux de change non trouvé pour ${from} → ${to}, retour montant original`);
    return amount;
  }

  return amount * rate;
}

/**
 * Formater un montant avec sa devise
 *
 * @param amount Montant
 * @param currency Devise
 * @param showSymbol Afficher le symbole (défaut: true)
 * @param decimals Nombre de décimales (défaut: 0)
 * @returns Montant formaté
 *
 * @example
 * formatCurrency(1000, 'AED') // "1,000 AED"
 * formatCurrency(1000, 'EUR', true, 2) // "1,000.00 €"
 */
export function formatCurrency(
  amount: number,
  currency: CurrencyCode,
  showSymbol: boolean = true,
  decimals: number = 0
): string {
  const curr = CURRENCIES[currency];

  if (!curr) {
    console.warn(`Devise inconnue: ${currency}`);
    return amount.toFixed(decimals);
  }

  // Formater le nombre avec séparateurs de milliers
  const formattedAmount = amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  if (showSymbol) {
    // Pour EUR, mettre le symbole après
    if (currency === 'EUR') {
      return `${formattedAmount} ${curr.symbol}`;
    }
    // Pour AED et USD, mettre avant
    return `${formattedAmount} ${curr.code}`;
  }

  return formattedAmount;
}

/**
 * Formater un montant avec double devise (principale + conversion)
 *
 * @param amount Montant dans la devise principale
 * @param primaryCurrency Devise principale
 * @param secondaryCurrency Devise secondaire (défaut: AUTO selon primaryCurrency)
 * @param showSymbols Afficher les symboles (défaut: true)
 * @param decimals Nombre de décimales (défaut: 0)
 * @returns Montant formaté dual-currency
 *
 * @example
 * formatDualCurrency(1000, 'AED') // "1,000 AED (250 €)"
 * formatDualCurrency(250, 'EUR') // "250 € (1,000 AED)"
 */
export function formatDualCurrency(
  amount: number,
  primaryCurrency: CurrencyCode,
  secondaryCurrency?: CurrencyCode,
  showSymbols: boolean = true,
  decimals: number = 0
): string {
  // Déterminer la devise secondaire automatiquement
  let secondary = secondaryCurrency;
  if (!secondary) {
    // Si primaire = AED → secondaire = EUR
    // Si primaire = EUR → secondaire = AED
    // Si primaire = USD → secondaire = EUR
    secondary = primaryCurrency === 'AED' ? 'EUR' :
                primaryCurrency === 'EUR' ? 'AED' :
                'EUR';
  }

  // Convertir
  const convertedAmount = convertCurrency(amount, primaryCurrency, secondary);

  // Formater les deux
  const primaryFormatted = formatCurrency(amount, primaryCurrency, showSymbols, decimals);
  const secondaryFormatted = formatCurrency(convertedAmount, secondary, showSymbols, decimals);

  return `${primaryFormatted} (${secondaryFormatted})`;
}

/**
 * Formater un montant compact pour affichage dans tableaux
 *
 * @param amount Montant
 * @param currency Devise
 * @returns Montant formaté compact
 *
 * @example
 * formatCompactCurrency(1500, 'AED') // "1.5k AED"
 * formatCompactCurrency(50, 'EUR') // "50 €"
 */
export function formatCompactCurrency(
  amount: number,
  currency: CurrencyCode
): string {
  const curr = CURRENCIES[currency];

  if (!curr) {
    return amount.toString();
  }

  let formatted: string;

  if (amount >= 1000000) {
    formatted = (amount / 1000000).toFixed(1) + 'M';
  } else if (amount >= 1000) {
    formatted = (amount / 1000).toFixed(1) + 'k';
  } else {
    formatted = amount.toFixed(0);
  }

  // Pour EUR, symbole après
  if (currency === 'EUR') {
    return `${formatted} ${curr.symbol}`;
  }

  return `${formatted} ${curr.code}`;
}

// ==================== DÉTECTION DEVISE ====================

/**
 * Détecter la devise d'un compte publicitaire
 *
 * @param accountId ID du compte (Facebook Ad Account ID ou Google Ads Account ID)
 * @param platform Plateforme ('facebook' | 'google')
 * @returns Promise<CurrencyCode> Devise détectée
 *
 * Note : Pour l'instant retourne AED (Dubai) par défaut
 * TODO: Interroger l'API Facebook/Google pour détecter automatiquement
 */
export async function detectAccountCurrency(
  accountId: string,
  platform: 'facebook' | 'google'
): Promise<CurrencyCode> {
  // TODO: Implémenter détection réelle via API
  // Pour l'instant, retourner AED car compte Facebook à Dubai

  if (platform === 'facebook') {
    // Compte Facebook Dubai = AED
    return 'AED';
  }

  if (platform === 'google') {
    // À implémenter selon la config Google Ads
    return 'EUR'; // Par défaut pour Google Ads européen
  }

  return DEFAULT_CURRENCY;
}

/**
 * Récupérer le taux de change actuel (pour future API externe)
 *
 * @param from Devise source
 * @param to Devise cible
 * @returns Promise<number> Taux de change
 *
 * Note : Pour l'instant retourne les taux hardcodés
 * TODO: Intégrer API externe (ex: exchangerate-api.com) pour taux temps réel
 */
export async function getExchangeRate(
  from: CurrencyCode,
  to: CurrencyCode
): Promise<number> {
  // TODO: Interroger API externe pour taux temps réel
  // Pour l'instant, utiliser les taux hardcodés

  if (from === to) {
    return 1;
  }

  const rateKey = `${from}_TO_${to}` as keyof typeof EXCHANGE_RATES;
  const rate = EXCHANGE_RATES[rateKey];

  if (!rate) {
    console.warn(`Taux de change non trouvé pour ${from} → ${to}`);
    return 1;
  }

  return rate;
}

// ==================== HELPERS POUR COMPOSANTS REACT ====================

/**
 * Hook-like helper pour formater dual-currency dans composants
 * (Non un vrai hook React, juste une fonction utilitaire)
 */
export const CurrencyFormatter = {
  /**
   * Formater pour affichage dans cartes KPI
   */
  kpi(amount: number, currency: CurrencyCode): { primary: string; secondary: string } {
    const secondary = currency === 'AED' ? 'EUR' : 'AED';
    const convertedAmount = convertCurrency(amount, currency, secondary);

    return {
      primary: formatCurrency(amount, currency, true, 0),
      secondary: formatCurrency(convertedAmount, secondary, true, 0),
    };
  },

  /**
   * Formater pour affichage dans tableaux
   */
  table(amount: number, currency: CurrencyCode): { main: string; sub: string } {
    const secondary = currency === 'AED' ? 'EUR' : 'AED';
    const convertedAmount = convertCurrency(amount, currency, secondary);

    return {
      main: formatCurrency(amount, currency, false, 0),
      sub: `(${formatCurrency(convertedAmount, secondary, true, 0)})`,
    };
  },

  /**
   * Formater compact pour graphiques
   */
  chart(amount: number, currency: CurrencyCode): string {
    return formatCompactCurrency(amount, currency);
  },
};

// ==================== EXPORT POUR BACKWARD COMPATIBILITY ====================

/**
 * Export des constantes pour backward compatibility
 * (permet de migrer progressivement l'ancien code)
 */
export const AED_TO_EUR = EXCHANGE_RATES.AED_TO_EUR;
export const EUR_TO_AED = EXCHANGE_RATES.EUR_TO_AED;
export const AED_TO_USD = EXCHANGE_RATES.AED_TO_USD;
export const USD_TO_AED = EXCHANGE_RATES.USD_TO_AED;
