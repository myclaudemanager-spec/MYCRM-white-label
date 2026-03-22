/**
 * 🔄 DÉDUPLICATEUR DE LEADS
 *
 * Détecte les leads en doublon avant insertion.
 * Stratégies :
 * 1. Mobile exact
 * 2. Email exact
 * 3. Nom + Prénom (fuzzy matching futur)
 */

import prisma from './prisma';
import type { RawLeadData } from './lead-ingestion-service';

export class LeadDeduplicator {
  /**
   * Rechercher un doublon existant
   * Retourne le client existant ou null
   */
  async findDuplicate(data: RawLeadData): Promise<any | null> {
    // Stratégie 1 : Recherche par téléphone (exact)
    if (data.mobile || data.phone) {
      const phone = data.mobile || data.phone;

      const existingByPhone = await prisma.client.findFirst({
        where: {
          OR: [
            { mobile: phone },
            { phone1: phone },
          ]
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          mobile: true,
          phone1: true,
          email: true,
          zipCode: true,
          city: true,
          isOwner: true,
          statusCall: true,
          statusRDV: true,
          callHistory: true,
          leadScore: true,
          createdAt: true,
          fbLeadId: true,
          fbCampaignName: true,
        }
      });

      if (existingByPhone) {
        console.log(`[LeadDeduplicator] 🔍 Duplicate trouvé par téléphone: Client ID ${existingByPhone.id}`);
        return existingByPhone;
      }
    }

    // Stratégie 2 : Recherche par email (exact)
    if (data.email) {
      const existingByEmail = await prisma.client.findFirst({
        where: {
          email: data.email.toLowerCase(),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          mobile: true,
          phone1: true,
          email: true,
          zipCode: true,
          city: true,
          isOwner: true,
          statusCall: true,
          statusRDV: true,
          callHistory: true,
          leadScore: true,
          createdAt: true,
          fbLeadId: true,
          fbCampaignName: true,
        }
      });

      if (existingByEmail) {
        console.log(`[LeadDeduplicator] 🔍 Duplicate trouvé par email: Client ID ${existingByEmail.id}`);
        return existingByEmail;
      }
    }

    // Stratégie 3 : Recherche par nom + prénom (exact)
    // Seulement si on a ni téléphone ni email
    if (!data.mobile && !data.phone && !data.email) {
      const existingByName = await prisma.client.findFirst({
        where: {
          firstName: data.firstName,
          lastName: data.lastName,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          mobile: true,
          phone1: true,
          email: true,
          zipCode: true,
          city: true,
          isOwner: true,
          statusCall: true,
          statusRDV: true,
          callHistory: true,
          leadScore: true,
          createdAt: true,
          fbLeadId: true,
          fbCampaignName: true,
        }
      });

      if (existingByName) {
        console.log(`[LeadDeduplicator] 🔍 Duplicate trouvé par nom: Client ID ${existingByName.id}`);
        return existingByName;
      }
    }

    // Aucun doublon trouvé
    return null;
  }

  /**
   * Fuzzy matching nom + prénom (futur)
   * Utiliserait une librairie comme `fuse.js` ou `string-similarity`
   */
  private async findByFuzzyName(firstName: string, lastName: string): Promise<any | null> {
    // TODO: Implémenter fuzzy matching si nécessaire
    // Pour l'instant, on utilise exact match uniquement
    return null;
  }
}
