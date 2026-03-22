import { describe, it, expect, beforeAll } from 'vitest';
import {
  encrypt,
  decrypt,
  isEncrypted,
  generateEncryptionKey,
} from '../src/lib/encryption';

/**
 * Tests du système de chiffrement AES-256-GCM (RGPD)
 */

describe('Système de chiffrement RGPD', () => {
  // Simuler ENCRYPTION_KEY pour les tests
  beforeAll(() => {
    if (!process.env.ENCRYPTION_KEY) {
      process.env.ENCRYPTION_KEY = generateEncryptionKey();
    }
  });

  describe('Chiffrement/Déchiffrement basique', () => {
    it('devrait chiffrer une chaîne de caractères', () => {
      const original = 'test@example.com';
      const encrypted = encrypt(original);

      expect(encrypted).not.toBeNull();
      expect(encrypted).not.toBe(original);
      expect(encrypted).toContain(':'); // Format iv:authTag:encrypted
    });

    it('devrait déchiffrer une chaîne chiffrée', () => {
      const original = 'test@example.com';
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(original);
    });

    it('devrait retourner null pour chaîne vide', () => {
      const encrypted = encrypt('');
      expect(encrypted).toBeNull();

      const decrypted = decrypt('');
      expect(decrypted).toBeNull();
    });

    it('devrait retourner null pour null', () => {
      const encrypted = encrypt(null);
      expect(encrypted).toBeNull();

      const decrypted = decrypt(null);
      expect(decrypted).toBeNull();
    });
  });

  describe('Format chiffrement', () => {
    it('devrait générer un format iv:authTag:encrypted', () => {
      const encrypted = encrypt('test@example.com');

      expect(encrypted).not.toBeNull();
      if (encrypted) {
        const parts = encrypted.split(':');
        expect(parts).toHaveLength(3);

        const [iv, authTag, encryptedData] = parts;
        expect(iv).toBeTruthy();
        expect(authTag).toBeTruthy();
        expect(encryptedData).toBeTruthy();
      }
    });

    it('devrait utiliser un IV différent à chaque chiffrement', () => {
      const original = 'test@example.com';
      const encrypted1 = encrypt(original);
      const encrypted2 = encrypt(original);

      expect(encrypted1).not.toBe(encrypted2); // IVs différents
    });
  });

  describe('Détection chiffrement', () => {
    it('devrait détecter une chaîne chiffrée', () => {
      const encrypted = encrypt('test@example.com');
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('devrait détecter une chaîne NON chiffrée', () => {
      const plain = 'test@example.com';
      expect(isEncrypted(plain)).toBe(false);
    });

    it('devrait retourner false pour null', () => {
      expect(isEncrypted(null)).toBe(false);
    });
  });

  describe('Gestion erreurs', () => {
    it('devrait gérer les données non chiffrées lors du déchiffrement', () => {
      const plain = 'test@example.com';
      const result = decrypt(plain);

      // Devrait retourner tel quel (migration en cours)
      expect(result).toBe(plain);
    });

    it('devrait gérer un format invalide', () => {
      const invalid = 'invalid:format';
      const result = decrypt(invalid);

      // Devrait retourner tel quel au lieu de crash
      expect(result).toBe(invalid);
    });
  });

  describe('Données sensibles', () => {
    it('devrait chiffrer un email', () => {
      const email = 'jean.dupont@example.com';
      const encrypted = encrypt(email);
      const decrypted = decrypt(encrypted);

      expect(encrypted).not.toBe(email);
      expect(decrypted).toBe(email);
    });

    it('devrait chiffrer un numéro de téléphone', () => {
      const phone = '+33612345678';
      const encrypted = encrypt(phone);
      const decrypted = decrypt(encrypted);

      expect(encrypted).not.toBe(phone);
      expect(decrypted).toBe(phone);
    });

    it('devrait chiffrer une adresse', () => {
      const address = '123 Rue de la Paix, 75001 Paris';
      const encrypted = encrypt(address);
      const decrypted = decrypt(encrypted);

      expect(encrypted).not.toBe(address);
      expect(decrypted).toBe(address);
    });

    it('devrait chiffrer des observations', () => {
      const observation = 'Client très intéressé, rappeler dans 2 jours';
      const encrypted = encrypt(observation);
      const decrypted = decrypt(encrypted);

      expect(encrypted).not.toBe(observation);
      expect(decrypted).toBe(observation);
    });
  });

  describe('Sécurité', () => {
    it('devrait générer des clés de 32 bytes (256 bits)', () => {
      const key = generateEncryptionKey();
      const keyBuffer = Buffer.from(key, 'base64');

      expect(keyBuffer.length).toBe(32); // 256 bits
    });

    it('devrait générer des clés uniques', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();

      expect(key1).not.toBe(key2);
    });

    it('devrait préserver les caractères spéciaux', () => {
      const special = 'Café & Thé @ 10€ 🎉';
      const encrypted = encrypt(special);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(special);
    });

    it('devrait préserver les accents', () => {
      const accents = 'àâäéèêëïîôùûüÿæœç ÀÂÄÉÈÊËÏÎÔÙÛÜŸÆŒÇ';
      const encrypted = encrypt(accents);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(accents);
    });

    it('devrait gérer les longues chaînes', () => {
      const long = 'a'.repeat(10000); // 10k caractères
      const encrypted = encrypt(long);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(long);
      expect(decrypted?.length).toBe(10000);
    });
  });

  describe('Conformité RGPD', () => {
    it('devrait chiffrer les données PII (Personally Identifiable Information)', () => {
      const pii = {
        email: 'jean.dupont@example.com',
        mobile: '+33612345678',
        address: '123 Rue de la Paix',
      };

      const encryptedEmail = encrypt(pii.email);
      const encryptedMobile = encrypt(pii.mobile);
      const encryptedAddress = encrypt(pii.address);

      // Vérifier que toutes sont chiffrées
      expect(isEncrypted(encryptedEmail)).toBe(true);
      expect(isEncrypted(encryptedMobile)).toBe(true);
      expect(isEncrypted(encryptedAddress)).toBe(true);

      // Vérifier qu'on peut les déchiffrer
      expect(decrypt(encryptedEmail)).toBe(pii.email);
      expect(decrypt(encryptedMobile)).toBe(pii.mobile);
      expect(decrypt(encryptedAddress)).toBe(pii.address);
    });

    it('devrait utiliser AES-256-GCM (authentification)', () => {
      const data = 'test@example.com';
      const encrypted = encrypt(data);

      if (encrypted) {
        const [iv, authTag, encryptedData] = encrypted.split(':');

        // Vérifier présence AuthTag (GCM)
        expect(authTag).toBeTruthy();
        expect(Buffer.from(authTag, 'base64').length).toBe(16); // 128 bits
      }
    });
  });
});
