/**
 * VALIDATEUR DE LEADS
 *
 * REGLE (2026-02-23) :
 * Le CRM rejette les locataires et appartements (422 -> Facebook apprend).
 * Le CRM accepte tout le reste sans exception, sauf les doublons.
 * La deduplication est geree dans lead-ingestion-service.
 */

import { LeadSource, ValidationStatus, RawLeadData } from './lead-ingestion-service';

export interface ValidationResult {
  valid: boolean;
  status: ValidationStatus;
  error?: string;
}

// Valeurs isOwner qui indiquent un locataire
const REJECTED_OWNER_VALUES = [
  'locataire',
  'non',
  'non_',
  'non propriétaire',
  'non-propriétaire',
];

// Valeurs isOwner qui indiquent un appartement / copropriete
const REJECTED_HOUSING_VALUES = [
  'appartement',
  'copropriété',
  'copropriete',
  'immeuble',
];

export class LeadValidator {
  /**
   * Valider selon la source
   *
   * Rejet des locataires et appartements -> 422 vers Facebook.
   * Tout le reste est accepte.
   */
  async validateBySource(
    source: LeadSource,
    data: RawLeadData
  ): Promise<ValidationResult> {
    // Seul check nom : il faut au minimum un nom
    if (!data.firstName && !data.lastName) {
      if (!data.firstName) data.firstName = 'Inconnu';
      if (!data.lastName) data.lastName = 'Inconnu';
    }

    // --- REJET LOCATAIRES ---
    if (data.isOwner) {
      const ownerNormalized = data.isOwner.toLowerCase().trim();

      // Rejet locataires
      if (
        REJECTED_OWNER_VALUES.some(
          (val) => ownerNormalized === val || ownerNormalized.startsWith(val)
        )
      ) {
        return {
          valid: false,
          status: ValidationStatus.REJECTED,
          error: `Locataire rejete (isOwner: "${data.isOwner}")`,
        };
      }

      // Rejet appartements / coproprietes
      if (
        REJECTED_HOUSING_VALUES.some(
          (val) => ownerNormalized === val || ownerNormalized.includes(val)
        )
      ) {
        return {
          valid: false,
          status: ValidationStatus.REJECTED,
          error: `Type logement non eligible (isOwner: "${data.isOwner}")`,
        };
      }
    }

    // TOUT LE RESTE EST ACCEPTE
    return {
      valid: true,
      status: ValidationStatus.VALID,
    };
  }
}
