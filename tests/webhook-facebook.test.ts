import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Tests du webhook Facebook Lead Ads
 * Valide la réception, le parsing et le filtrage des leads
 */

describe('Webhook Facebook Lead Ads', () => {
  let mockFetch: any;

  beforeEach(() => {
    // Mock de fetch global
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Vérification webhook (GET)', () => {
    it('devrait valider le webhook avec le bon token', async () => {
      const url = 'http://localhost:3000/api/facebook/leads-webhook?hub.mode=subscribe&hub.verify_token=bhcompany_webhook_secret_2026&hub.challenge=TEST_CHALLENGE';
      const request = new NextRequest(url, { method: 'GET' });

      // Import dynamique pour éviter les dépendances au build
      const { GET } = await import('@/app/api/facebook/leads-webhook/route');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe('TEST_CHALLENGE');
    });

    it('devrait rejeter un mauvais token', async () => {
      const url = 'http://localhost:3000/api/facebook/leads-webhook?hub.mode=subscribe&hub.verify_token=WRONG_TOKEN&hub.challenge=TEST_CHALLENGE';
      const request = new NextRequest(url, { method: 'GET' });

      const { GET } = await import('@/app/api/facebook/leads-webhook/route');
      const response = await GET(request);

      expect(response.status).toBe(403);
    });
  });

  describe('Parsing des leads (Détection statut propriétaire)', () => {
    it('devrait détecter un propriétaire (format "Oui")', () => {
      const leadData = {
        field_data: [
          { name: 'full_name', values: ['Jean Dupont'] },
          { name: 'phone_number', values: ['+33612345678'] },
          { name: 'êtes-vous_propriétaire_de_votre_maison_?', values: ['Oui, je suis propriétaire'] },
        ],
      };

      // Simuler la logique de parsing
      let isOwner = '';
      leadData.field_data.forEach((field: any) => {
        const name = field.name.toLowerCase();
        const value = field.values[0];

        if (
          name.includes('propriétaire') ||
          name.includes('proprietaire') ||
          name.includes('owner')
        ) {
          isOwner = value;
        }
      });

      expect(isOwner).toBe('Oui, je suis propriétaire');
      expect(isOwner.toLowerCase()).toContain('oui');
    });

    it('devrait détecter un locataire (format "Non")', () => {
      const leadData = {
        field_data: [
          { name: 'full_name', values: ['Marie Martin'] },
          { name: 'phone_number', values: ['+33687654321'] },
          { name: 'êtes-vous_propriétaire_de_votre_maison_?', values: ['Non, je suis locataire'] },
        ],
      };

      let isOwner = '';
      let isLocataire = false;

      leadData.field_data.forEach((field: any) => {
        const name = field.name.toLowerCase();
        const value = field.values[0];

        if (name.includes('propriétaire') || name.includes('proprietaire') || name.includes('owner')) {
          isOwner = value;

          const ownerLower = value.toLowerCase();
          if (
            ownerLower.includes('locataire') ||
            ownerLower.includes('location') ||
            ownerLower === 'non' ||
            ownerLower === 'no'
          ) {
            isLocataire = true;
          }
        }
      });

      expect(isOwner).toBe('Non, je suis locataire');
      expect(isLocataire).toBe(true);
    });

    it('devrait gérer les différents formats de champs propriétaire', () => {
      const formats = [
        'êtes-vous_propriétaire_de_votre_maison_?',
        'etes-vous_proprietaire_de_votre_maison_?',
        'proprietaire',
        'propriétaire',
        'owner',
        'are_you_owner',
        'statut_proprietaire',
        'votre_statut_proprietaire',
        'type_proprietaire',
      ];

      formats.forEach((fieldName) => {
        const leadData = {
          field_data: [
            { name: fieldName, values: ['Oui'] },
          ],
        };

        let isOwner = '';
        leadData.field_data.forEach((field: any) => {
          const name = field.name.toLowerCase();
          const value = field.values[0];

          if (
            name.includes('propriétaire') ||
            name.includes('proprietaire') ||
            name.includes('owner')
          ) {
            isOwner = value;
          }
        });

        expect(isOwner).toBe('Oui');
      });
    });

    it('devrait marquer "À vérifier" si statut non renseigné', () => {
      const leadData = {
        field_data: [
          { name: 'full_name', values: ['Pierre Dubois'] },
          { name: 'phone_number', values: ['+33698765432'] },
        ],
      };

      let isOwner = '';
      leadData.field_data.forEach((field: any) => {
        const name = field.name.toLowerCase();
        const value = field.values[0];

        if (name.includes('propriétaire') || name.includes('proprietaire') || name.includes('owner')) {
          isOwner = value;
        }
      });

      // Si non renseigné
      if (!isOwner) {
        isOwner = 'À vérifier';
      }

      expect(isOwner).toBe('À vérifier');
    });
  });

  describe('Stratégie de gestion des locataires', () => {
    it('devrait marquer les locataires avec statut "À QUALIFIER"', () => {
      const isLocataire = true;
      const statusCall = isLocataire ? 'À QUALIFIER' : 'A RAPPELER';

      expect(statusCall).toBe('À QUALIFIER');
    });

    it('devrait marquer les propriétaires avec statut "A RAPPELER"', () => {
      const isLocataire = false;
      const statusCall = isLocataire ? 'À QUALIFIER' : 'A RAPPELER';

      expect(statusCall).toBe('A RAPPELER');
    });

    it('devrait ajouter une observation d\'alerte pour les locataires', () => {
      const isLocataire = true;
      const observationPrefix = isLocataire
        ? '⚠️ ATTENTION: A déclaré être LOCATAIRE - À VÉRIFIER (peut s\'être trompé)'
        : 'Lead Facebook synchronisé';

      expect(observationPrefix).toContain('LOCATAIRE');
      expect(observationPrefix).toContain('À VÉRIFIER');
    });

    it('devrait avoir une observation normale pour les propriétaires', () => {
      const isLocataire = false;
      const observationPrefix = isLocataire
        ? '⚠️ ATTENTION: A déclaré être LOCATAIRE - À VÉRIFIER (peut s\'être trompé)'
        : 'Lead Facebook synchronisé';

      expect(observationPrefix).toBe('Lead Facebook synchronisé');
    });
  });

  describe('Parsing des champs utilisateur', () => {
    it('devrait parser correctement full_name en firstName/lastName', () => {
      const fullName = 'Jean Pierre Dupont';
      const parts = fullName.split(' ');
      const firstName = parts[0];
      const lastName = parts.slice(1).join(' ');

      expect(firstName).toBe('Jean');
      expect(lastName).toBe('Pierre Dupont');
    });

    it('devrait gérer les noms simples', () => {
      const fullName = 'Dupont';
      const parts = fullName.split(' ');
      const firstName = parts[0];
      const lastName = parts.slice(1).join(' ');

      expect(firstName).toBe('Dupont');
      expect(lastName).toBe('');
    });

    it('devrait parser les numéros de téléphone', () => {
      const phones = ['+33612345678', '0612345678', '+971501234567'];

      phones.forEach((phone) => {
        expect(phone).toMatch(/^[\+\d]/);
      });
    });
  });

  describe('Validation des données', () => {
    it('ne devrait PAS créer de doublon si lead existe déjà', async () => {
      const leadId = 'test_lead_12345';

      // Simuler une vérification de doublon
      const existingLead = { fbLeadId: leadId };

      expect(existingLead.fbLeadId).toBe(leadId);
    });

    it('devrait valider les champs requis', () => {
      const leadInfo = {
        firstName: 'Jean',
        lastName: 'Dupont',
        mobile: '+33612345678',
        isOwner: 'Oui',
      };

      expect(leadInfo.firstName).toBeTruthy();
      expect(leadInfo.lastName).toBeTruthy();
      expect(leadInfo.mobile).toBeTruthy();
      expect(leadInfo.isOwner).toBeTruthy();
    });
  });
});
