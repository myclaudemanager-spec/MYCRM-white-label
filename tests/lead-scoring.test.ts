import { describe, it, expect } from 'vitest';

/**
 * Tests du système de scoring automatique des leads
 * Score de 0 à 200 points basé sur 7 critères
 */

describe('Système de scoring des leads', () => {
  /**
   * Fonction de calcul du score (extraite de la logique métier)
   */
  function calculateLeadScore(client: any) {
    let score = 0;
    const details: string[] = [];

    // 1. Propriétaire (50 points) - CRITIQUE
    if (client.isOwner) {
      const ownerLower = client.isOwner.toLowerCase();
      if (ownerLower.includes('oui') || ownerLower.includes('propriétaire')) {
        score += 50;
        details.push('✅ Propriétaire (+50)');
      } else if (ownerLower.includes('locataire') || ownerLower === 'non') {
        score += 0;
        details.push('❌ Locataire (+0)');
      } else {
        score += 10;
        details.push('⚠️ Statut inconnu (+10)');
      }
    }

    // 2. Contact (30 points)
    let contactScore = 0;
    if (client.mobile) contactScore += 20;
    if (client.email) contactScore += 10;
    score += contactScore;
    if (contactScore === 30) details.push('📞 Coordonnées complètes (+30)');
    else if (contactScore === 20) details.push('📞 Téléphone uniquement (+20)');
    else if (contactScore === 10) details.push('📧 Email uniquement (+10)');

    // 3. Localisation (20 points)
    let locationScore = 0;
    if (client.zipCode) locationScore += 10;
    if (client.city) locationScore += 10;
    score += locationScore;
    if (locationScore === 20) details.push('📍 Localisation complète (+20)');
    else if (locationScore > 0) details.push(`📍 Localisation partielle (+${locationScore})`);

    // 4. Source (30 points)
    if (client.campaign) {
      if (client.campaign.includes('FACEBOOK')) {
        score += 30;
        details.push('🎯 Facebook Ads (+30)');
      } else if (client.campaign.includes('GOOGLE')) {
        score += 25;
        details.push('🔍 Google Ads (+25)');
      } else {
        score += 15;
        details.push('📢 Autre source (+15)');
      }
    }

    // 5. Rapidité (30 points) - Lead récent
    const now = new Date();
    const createdAt = new Date(client.createdAt || now);
    const hoursAgo = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    if (hoursAgo < 24) {
      score += 30;
      details.push('⚡ Lead récent (<24h) (+30)');
    } else if (hoursAgo < 72) {
      score += 15;
      details.push('⏱️ Lead moyen (<3j) (+15)');
    } else {
      score += 5;
      details.push('⏳ Lead ancien (+5)');
    }

    // 6. Statut appel (20 points)
    if (client.statusCall === 'A RAPPELER') {
      score += 20;
      details.push('📞 À rappeler (+20)');
    } else if (client.statusCall === 'RDV PRIS') {
      score += 15;
      details.push('📅 RDV pris (+15)');
    } else if (client.statusCall === 'INTÉRESSÉ') {
      score += 10;
      details.push('💡 Intéressé (+10)');
    }

    // 7. Notes (20 points)
    if (client.observation && client.observation.length > 20) {
      score += 20;
      details.push('📝 Notes détaillées (+20)');
    } else if (client.observation && client.observation.length > 0) {
      score += 10;
      details.push('📝 Notes courtes (+10)');
    }

    // Priorité
    let priority = 'BASSE';
    if (score >= 150) priority = 'HAUTE';
    else if (score >= 100) priority = 'MOYENNE';

    return {
      score,
      priority,
      details: details.join('\n'),
    };
  }

  describe('Scoring propriétaire (50 points max)', () => {
    it('devrait donner 50 points pour un propriétaire', () => {
      const client = {
        isOwner: 'Oui, je suis propriétaire',
        createdAt: new Date(),
      };

      const result = calculateLeadScore(client);

      expect(result.details).toContain('Propriétaire (+50)');
      expect(result.score).toBeGreaterThanOrEqual(50);
    });

    it('devrait donner 0 points pour un locataire', () => {
      const client = {
        isOwner: 'Non, je suis locataire',
        createdAt: new Date(),
      };

      const result = calculateLeadScore(client);

      expect(result.details).toContain('Locataire (+0)');
    });

    it('devrait donner 10 points si statut inconnu', () => {
      const client = {
        isOwner: 'À vérifier',
        createdAt: new Date(),
      };

      const result = calculateLeadScore(client);

      expect(result.details).toContain('Statut inconnu (+10)');
    });
  });

  describe('Scoring contact (30 points max)', () => {
    it('devrait donner 30 points pour coordonnées complètes', () => {
      const client = {
        mobile: '+33612345678',
        email: 'test@example.com',
        createdAt: new Date(),
      };

      const result = calculateLeadScore(client);

      expect(result.details).toContain('Coordonnées complètes (+30)');
    });

    it('devrait donner 20 points pour téléphone uniquement', () => {
      const client = {
        mobile: '+33612345678',
        email: null,
        createdAt: new Date(),
      };

      const result = calculateLeadScore(client);

      expect(result.details).toContain('Téléphone uniquement (+20)');
    });

    it('devrait donner 10 points pour email uniquement', () => {
      const client = {
        mobile: null,
        email: 'test@example.com',
        createdAt: new Date(),
      };

      const result = calculateLeadScore(client);

      expect(result.details).toContain('Email uniquement (+10)');
    });
  });

  describe('Scoring localisation (20 points max)', () => {
    it('devrait donner 20 points pour localisation complète', () => {
      const client = {
        zipCode: '13001',
        city: 'Marseille',
        createdAt: new Date(),
      };

      const result = calculateLeadScore(client);

      expect(result.details).toContain('Localisation complète (+20)');
    });

    it('devrait donner 10 points pour code postal uniquement', () => {
      const client = {
        zipCode: '13001',
        city: null,
        createdAt: new Date(),
      };

      const result = calculateLeadScore(client);

      expect(result.details).toContain('Localisation partielle (+10)');
    });
  });

  describe('Scoring source campagne (30 points max)', () => {
    it('devrait donner 30 points pour Facebook Ads', () => {
      const client = {
        campaign: 'FACEBOOK_LEAD_ADS',
        createdAt: new Date(),
      };

      const result = calculateLeadScore(client);

      expect(result.details).toContain('Facebook Ads (+30)');
    });

    it('devrait donner 25 points pour Google Ads', () => {
      const client = {
        campaign: 'GOOGLE_ADS',
        createdAt: new Date(),
      };

      const result = calculateLeadScore(client);

      expect(result.details).toContain('Google Ads (+25)');
    });

    it('devrait donner 15 points pour autre source', () => {
      const client = {
        campaign: 'REFERRAL',
        createdAt: new Date(),
      };

      const result = calculateLeadScore(client);

      expect(result.details).toContain('Autre source (+15)');
    });
  });

  describe('Scoring rapidité (30 points max)', () => {
    it('devrait donner 30 points pour lead récent (<24h)', () => {
      const now = new Date();
      const client = {
        createdAt: new Date(now.getTime() - 12 * 60 * 60 * 1000), // 12h ago
      };

      const result = calculateLeadScore(client);

      expect(result.details).toContain('Lead récent (<24h) (+30)');
    });

    it('devrait donner 15 points pour lead moyen (<3j)', () => {
      const now = new Date();
      const client = {
        createdAt: new Date(now.getTime() - 48 * 60 * 60 * 1000), // 2j ago
      };

      const result = calculateLeadScore(client);

      expect(result.details).toContain('Lead moyen (<3j) (+15)');
    });

    it('devrait donner 5 points pour lead ancien (>3j)', () => {
      const now = new Date();
      const client = {
        createdAt: new Date(now.getTime() - 168 * 60 * 60 * 1000), // 7j ago
      };

      const result = calculateLeadScore(client);

      expect(result.details).toContain('Lead ancien (+5)');
    });
  });

  describe('Priorité globale', () => {
    it('devrait classer HAUTE pour score >= 150', () => {
      const client = {
        isOwner: 'Oui, propriétaire', // +50
        mobile: '+33612345678', // +20
        email: 'test@example.com', // +10
        zipCode: '13001', // +10
        city: 'Marseille', // +10
        campaign: 'FACEBOOK_LEAD_ADS', // +30
        createdAt: new Date(), // +30 (récent)
        statusCall: 'A RAPPELER', // +20
        observation: 'Client très intéressé par installation photovoltaïque', // +20
      };

      const result = calculateLeadScore(client);

      expect(result.score).toBeGreaterThanOrEqual(150);
      expect(result.priority).toBe('HAUTE');
    });

    it('devrait classer MOYENNE pour score entre 100-149', () => {
      const client = {
        isOwner: 'Oui, propriétaire', // +50
        mobile: '+33612345678', // +20
        zipCode: '13001', // +10
        campaign: 'FACEBOOK_LEAD_ADS', // +30
        createdAt: new Date(), // +30
      };

      const result = calculateLeadScore(client);

      expect(result.score).toBeGreaterThanOrEqual(100);
      expect(result.score).toBeLessThan(150);
      expect(result.priority).toBe('MOYENNE');
    });

    it('devrait classer BASSE pour score < 100', () => {
      const client = {
        isOwner: 'Non, locataire', // +0
        mobile: '+33612345678', // +20
        createdAt: new Date(Date.now() - 168 * 60 * 60 * 1000), // +5 (ancien)
      };

      const result = calculateLeadScore(client);

      expect(result.score).toBeLessThan(100);
      expect(result.priority).toBe('BASSE');
    });
  });

  describe('Cas réels', () => {
    it('Lead Facebook parfait (score max ~200)', () => {
      const client = {
        isOwner: 'Oui, je suis propriétaire',
        mobile: '+33612345678',
        email: 'jean.dupont@example.com',
        zipCode: '13001',
        city: 'Marseille',
        campaign: 'FACEBOOK_LEAD_ADS',
        createdAt: new Date(),
        statusCall: 'A RAPPELER',
        observation: 'Très intéressé, maison 120m², toit sud, déjà contacté installateur concurrent mais pas satisfait du prix',
      };

      const result = calculateLeadScore(client);

      expect(result.score).toBeGreaterThanOrEqual(190);
      expect(result.priority).toBe('HAUTE');
    });

    it('Locataire (score faible)', () => {
      const client = {
        isOwner: 'Non, je suis locataire',
        mobile: '+33612345678',
        createdAt: new Date(),
        statusCall: 'À QUALIFIER',
      };

      const result = calculateLeadScore(client);

      expect(result.score).toBeLessThan(100);
      expect(result.priority).toBe('BASSE');
    });

    it('Lead incomplet (score moyen)', () => {
      const client = {
        isOwner: 'À vérifier',
        mobile: '+33612345678',
        createdAt: new Date(),
      };

      const result = calculateLeadScore(client);

      expect(result.score).toBeLessThan(150);
    });
  });
});
