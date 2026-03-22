/**
 * Utilitaires pour gérer l'historique des appels et changements de statut
 * Format JSON stocké dans callHistory et statusHistory
 */

export interface HistoryEntry {
  date: string; // ISO 8601
  user: string; // Nom de l'utilisateur
  action: string; // Type d'action (ex: "Appel", "Changement statut")
  detail: string; // Détails de l'action
  oldValue?: string; // Ancienne valeur (pour changements)
  newValue?: string; // Nouvelle valeur (pour changements)
}

/**
 * Ajoute une entrée à l'historique
 * @param currentHistory - Historique actuel (string JSON ou null)
 * @param entry - Nouvelle entrée à ajouter
 * @returns Historique mis à jour (string JSON)
 */
export function addHistoryEntry(
  currentHistory: string | null,
  entry: HistoryEntry
): string {
  let history: HistoryEntry[] = [];

  // Parser l'historique existant
  if (currentHistory) {
    try {
      history = JSON.parse(currentHistory);
      if (!Array.isArray(history)) {
        history = [];
      }
    } catch {
      history = [];
    }
  }

  // Ajouter la nouvelle entrée au début (plus récent en premier)
  history.unshift(entry);

  // Limiter à 100 entrées pour éviter que le JSON devienne trop gros
  if (history.length > 100) {
    history = history.slice(0, 100);
  }

  return JSON.stringify(history);
}

/**
 * Parse l'historique JSON
 * @param historyJson - String JSON de l'historique
 * @returns Array d'entrées d'historique
 */
export function parseHistory(historyJson: string | null): HistoryEntry[] {
  if (!historyJson) return [];

  try {
    const history = JSON.parse(historyJson);
    return Array.isArray(history) ? history : [];
  } catch {
    return [];
  }
}

/**
 * Crée une entrée d'historique pour un appel
 */
export function createCallHistoryEntry(
  userName: string,
  result: string,
  comment?: string | null,
  callTime?: string
): HistoryEntry {
  const detail = comment
    ? `${result} - ${comment}`
    : result;

  return {
    date: new Date().toISOString(),
    user: userName,
    action: "Appel",
    detail: callTime ? `${callTime} - ${detail}` : detail,
    newValue: result,
  };
}

/**
 * Crée une entrée d'historique pour un changement de statut
 */
export function createStatusHistoryEntry(
  userName: string,
  statusType: "Call" | "RDV",
  oldStatus: string | null,
  newStatus: string
): HistoryEntry {
  return {
    date: new Date().toISOString(),
    user: userName,
    action: `Statut ${statusType}`,
    detail: `${oldStatus || "(vide)"} → ${newStatus}`,
    oldValue: oldStatus || undefined,
    newValue: newStatus,
  };
}

/**
 * Crée une entrée d'historique générique
 */
export function createGenericHistoryEntry(
  userName: string,
  action: string,
  detail: string
): HistoryEntry {
  return {
    date: new Date().toISOString(),
    user: userName,
    action,
    detail,
  };
}
