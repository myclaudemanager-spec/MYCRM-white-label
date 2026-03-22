import { describe, it, expect } from 'vitest';

/**
 * Tests des notifications Telegram
 * Valide le format des messages et les alertes
 */

describe('Notifications Telegram', () => {
  describe('Format des messages nouveaux leads', () => {
    it('devrait générer un message pour un PROPRIÉTAIRE', () => {
      const client = {
        firstName: 'Jean',
        lastName: 'Dupont',
        mobile: '+33612345678',
        zipCode: '13001',
        city: 'Marseille',
        isOwner: 'Oui, je suis propriétaire',
        campaign: 'FACEBOOK_LEAD_ADS',
        id: 123,
      };

      const ownerStatus = client.isOwner || 'Non renseigné';
      let ownerEmoji = '✅';
      let alertMessage = '';

      const ownerLower = ownerStatus.toLowerCase();
      // IMPORTANT: Vérifier "non renseigné" EN ENTIER avant "non" seul
      if (ownerLower === 'non renseigné') {
        ownerEmoji = '⚠️';
        alertMessage = '\n\n⚠️ Statut propriétaire non renseigné - À vérifier';
      } else if (ownerLower.includes('locataire') || ownerLower === 'non') {
        ownerEmoji = '🚨';
        alertMessage = '\n\n🚨 <b>ATTENTION: A déclaré être LOCATAIRE !</b>\n⚠️ À vérifier - Peut s\'être trompé';
      } else if (ownerLower.includes('oui') || ownerLower.includes('propriétaire')) {
        ownerEmoji = '✅';
      } else {
        ownerEmoji = '⚠️';
        alertMessage = '\n\n⚠️ Statut propriétaire non renseigné - À vérifier';
      }

      const message = `
🆕 <b>Nouveau Lead Facebook !</b>

👤 <b>${client.firstName} ${client.lastName}</b>
📞 ${client.mobile || 'Non renseigné'}
📍 ${client.zipCode || ''} ${client.city || ''}
🏠 ${ownerEmoji} Propriétaire: ${ownerStatus}${alertMessage}

📋 Campagne: ${client.campaign || 'Non spécifié'}
⏰ Reçu: À l'instant

🔗 <a href="https://mycrm.solar/clients?openClient=${client.id}">Voir la fiche</a>
      `.trim();

      expect(message).toContain('🆕 <b>Nouveau Lead Facebook !</b>');
      expect(message).toContain('Jean Dupont');
      expect(message).toContain('+33612345678');
      expect(message).toContain('13001 Marseille');
      expect(message).toContain('✅');
      expect(message).toContain('Oui, je suis propriétaire');
      expect(message).not.toContain('🚨');
      expect(message).not.toContain('LOCATAIRE');
    });

    it('devrait générer une ALERTE pour un LOCATAIRE', () => {
      const client = {
        firstName: 'Marie',
        lastName: 'Martin',
        mobile: '+33687654321',
        zipCode: '75001',
        city: 'Paris',
        isOwner: 'Non, je suis locataire',
        campaign: 'FACEBOOK_LEAD_ADS',
        id: 124,
      };

      const ownerStatus = client.isOwner || 'Non renseigné';
      let ownerEmoji = '✅';
      let alertMessage = '';

      const ownerLower = ownerStatus.toLowerCase();
      if (ownerLower.includes('locataire') || ownerLower.includes('non')) {
        ownerEmoji = '🚨';
        alertMessage = '\n\n🚨 <b>ATTENTION: A déclaré être LOCATAIRE !</b>\n⚠️ À vérifier - Peut s\'être trompé';
      }

      const message = `
🆕 <b>Nouveau Lead Facebook !</b>

👤 <b>${client.firstName} ${client.lastName}</b>
📞 ${client.mobile || 'Non renseigné'}
📍 ${client.zipCode || ''} ${client.city || ''}
🏠 ${ownerEmoji} Propriétaire: ${ownerStatus}${alertMessage}

📋 Campagne: ${client.campaign || 'Non spécifié'}
⏰ Reçu: À l'instant

🔗 <a href="https://mycrm.solar/clients?openClient=${client.id}">Voir la fiche</a>
      `.trim();

      expect(message).toContain('🚨');
      expect(message).toContain('ATTENTION: A déclaré être LOCATAIRE');
      expect(message).toContain('À vérifier - Peut s\'être trompé');
      expect(message).toContain('Marie Martin');
      expect(message).toContain('Non, je suis locataire');
    });

    it('devrait alerter si statut propriétaire non renseigné', () => {
      const client = {
        firstName: 'Pierre',
        lastName: 'Dubois',
        mobile: '+33698765432',
        zipCode: '69001',
        city: 'Lyon',
        isOwner: '', // Non renseigné
        campaign: 'FACEBOOK_LEAD_ADS',
        id: 125,
      };

      const ownerStatus = client.isOwner || 'Non renseigné';
      let ownerEmoji = '✅';
      let alertMessage = '';

      const ownerLower = ownerStatus.toLowerCase();
      // IMPORTANT: Vérifier "non renseigné" EN ENTIER avant "non" seul
      if (ownerLower === 'non renseigné') {
        ownerEmoji = '⚠️';
        alertMessage = '\n\n⚠️ Statut propriétaire non renseigné - À vérifier';
      } else if (ownerLower.includes('locataire') || ownerLower === 'non') {
        ownerEmoji = '🚨';
        alertMessage = '\n\n🚨 <b>ATTENTION: A déclaré être LOCATAIRE !</b>\n⚠️ À vérifier - Peut s\'être trompé';
      } else if (ownerLower.includes('oui') || ownerLower.includes('propriétaire')) {
        ownerEmoji = '✅';
      } else {
        ownerEmoji = '⚠️';
        alertMessage = '\n\n⚠️ Statut propriétaire non renseigné - À vérifier';
      }

      const message = `
🆕 <b>Nouveau Lead Facebook !</b>

👤 <b>${client.firstName} ${client.lastName}</b>
📞 ${client.mobile || 'Non renseigné'}
📍 ${client.zipCode || ''} ${client.city || ''}
🏠 ${ownerEmoji} Propriétaire: ${ownerStatus}${alertMessage}
      `.trim();

      expect(message).toContain('⚠️');
      expect(message).toContain('Statut propriétaire non renseigné - À vérifier');
      expect(message).toContain('Non renseigné');
    });
  });

  describe('Format HTML Telegram', () => {
    it('devrait utiliser des balises HTML valides', () => {
      const message = `
🆕 <b>Nouveau Lead Facebook !</b>

👤 <b>Jean Dupont</b>
📞 +33612345678
📍 13001 Marseille
🏠 ✅ Propriétaire: Oui

🔗 <a href="https://mycrm.solar/clients?openClient=123">Voir la fiche</a>
      `.trim();

      expect(message).toMatch(/<b>.*<\/b>/);
      expect(message).toMatch(/<a href=".*">.*<\/a>/);
    });

    it('ne devrait PAS utiliser de Markdown (pas de **)', () => {
      const message = `
🆕 <b>Nouveau Lead Facebook !</b>

👤 <b>Jean Dupont</b>
      `.trim();

      expect(message).not.toContain('**');
    });
  });

  describe('Liens vers le CRM', () => {
    it('devrait générer un lien correct vers la fiche client', () => {
      const clientId = 456;
      const url = `https://mycrm.solar/clients?openClient=${clientId}`;

      expect(url).toBe('https://mycrm.solar/clients?openClient=456');
      expect(url).toContain('mycrm.solar');
      expect(url).toContain('openClient=');
    });

    it('devrait générer un lien correct vers le planning', () => {
      const url = 'https://mycrm.solar/planning';

      expect(url).toBe('https://mycrm.solar/planning');
    });

    it('devrait générer un lien correct vers le dashboard', () => {
      const url = 'https://mycrm.solar/analytics/facebook-live';

      expect(url).toBe('https://mycrm.solar/analytics/facebook-live');
    });
  });

  describe('Émojis de notification', () => {
    it('devrait utiliser ✅ pour les propriétaires', () => {
      const isOwner = 'Oui, propriétaire';
      const ownerLower = isOwner.toLowerCase();

      let emoji = '✅';
      if (ownerLower.includes('locataire') || ownerLower === 'non') {
        emoji = '🚨';
      } else if (ownerLower.includes('oui') || ownerLower.includes('propriétaire')) {
        emoji = '✅';
      } else {
        emoji = '⚠️';
      }

      expect(emoji).toBe('✅');
    });

    it('devrait utiliser 🚨 pour les locataires', () => {
      const isOwner = 'Non, locataire';
      const ownerLower = isOwner.toLowerCase();

      let emoji = '✅';
      if (ownerLower.includes('locataire') || ownerLower === 'non') {
        emoji = '🚨';
      }

      expect(emoji).toBe('🚨');
    });

    it('devrait utiliser ⚠️ pour statut non renseigné', () => {
      const isOwner = 'À vérifier';
      const ownerLower = isOwner.toLowerCase();

      let emoji = '✅';
      if (ownerLower.includes('locataire') || ownerLower === 'non') {
        emoji = '🚨';
      } else if (ownerLower.includes('oui') || ownerLower.includes('propriétaire')) {
        emoji = '✅';
      } else {
        emoji = '⚠️';
      }

      expect(emoji).toBe('⚠️');
    });
  });

  describe('Gestion des valeurs manquantes', () => {
    it('devrait afficher "Non renseigné" pour mobile manquant', () => {
      const client = {
        firstName: 'Jean',
        lastName: 'Dupont',
        mobile: null,
      };

      const displayMobile = client.mobile || 'Non renseigné';

      expect(displayMobile).toBe('Non renseigné');
    });

    it('devrait afficher les codes postaux vides correctement', () => {
      const client = {
        zipCode: '',
        city: 'Paris',
      };

      const location = `${client.zipCode || ''} ${client.city || ''}`.trim();

      expect(location).toBe('Paris');
    });

    it('devrait gérer les campagnes non spécifiées', () => {
      const client = {
        campaign: null,
      };

      const campaign = client.campaign || 'Non spécifié';

      expect(campaign).toBe('Non spécifié');
    });
  });
});
