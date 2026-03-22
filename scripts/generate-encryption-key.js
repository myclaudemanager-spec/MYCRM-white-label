/**
 * Générer une clé de chiffrement AES-256 pour RGPD
 * À exécuter une seule fois lors du setup
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateEncryptionKey() {
  const key = crypto.randomBytes(32); // 256 bits
  return key.toString('base64');
}

function addKeyToEnv() {
  const envPath = path.join(__dirname, '..', '.env');

  // Vérifier si .env existe
  if (!fs.existsSync(envPath)) {
    console.error('❌ Fichier .env introuvable');
    process.exit(1);
  }

  // Lire .env
  let envContent = fs.readFileSync(envPath, 'utf8');

  // Vérifier si ENCRYPTION_KEY existe déjà
  if (envContent.includes('ENCRYPTION_KEY=')) {
    console.log('⚠️  ENCRYPTION_KEY existe déjà dans .env');
    console.log('❌ Refus de remplacer (perte de données chiffrées)');
    process.exit(1);
  }

  // Générer nouvelle clé
  const newKey = generateEncryptionKey();

  // Ajouter à .env
  envContent += `\n# Clé de chiffrement AES-256-GCM (RGPD)\nENCRYPTION_KEY="${newKey}"\n`;

  fs.writeFileSync(envPath, envContent, 'utf8');

  console.log('✅ Clé de chiffrement générée et ajoutée à .env');
  console.log('🔒 Clé :', newKey);
  console.log('');
  console.log('⚠️  IMPORTANT :');
  console.log('   1. Ne JAMAIS commit cette clé sur GitHub');
  console.log('   2. Sauvegarder cette clé en lieu sûr');
  console.log('   3. Perte de la clé = perte des données chiffrées');
  console.log('');
  console.log('📋 Prochaine étape : npm run db:encrypt (migration données)');
}

// Exécution
addKeyToEnv();
