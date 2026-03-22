/**
 * Script de migration : Chiffrer toutes les données sensibles existantes
 * À exécuter une seule fois après avoir généré ENCRYPTION_KEY
 */

import prisma from '../src/lib/prisma';
import {
  encrypt,
  isEncrypted,
  ENCRYPTED_CLIENT_FIELDS,
  ENCRYPTED_USER_FIELDS,
} from '../src/lib/encryption';

async function encryptDatabase() {
  console.log('🔒 Début du chiffrement de la base de données...\n');

  let clientsUpdated = 0;
  let usersUpdated = 0;

  try {
    // 1. Chiffrer les clients
    console.log('📋 Chiffrement des clients...');
    const clients = await prisma.client.findMany();

    for (const client of clients) {
      const updates: any = {};
      let hasChanges = false;

      // Chiffrer chaque champ sensible s'il n'est pas déjà chiffré
      ENCRYPTED_CLIENT_FIELDS.forEach((field) => {
        const value = (client as any)[field];

        if (value && !isEncrypted(value)) {
          updates[field] = encrypt(value);
          hasChanges = true;
        }
      });

      // Mettre à jour si nécessaire
      if (hasChanges) {
        await prisma.client.update({
          where: { id: client.id },
          data: updates,
        });
        clientsUpdated++;
        console.log(`  ✅ Client #${client.id} chiffré`);
      }
    }

    console.log(`\n✅ ${clientsUpdated}/${clients.length} clients chiffrés\n`);

    // 2. Chiffrer les utilisateurs
    console.log('👥 Chiffrement des utilisateurs...');
    const users = await prisma.user.findMany();

    for (const user of users) {
      const updates: any = {};
      let hasChanges = false;

      // Chiffrer chaque champ sensible s'il n'est pas déjà chiffré
      ENCRYPTED_USER_FIELDS.forEach((field) => {
        const value = (user as any)[field];

        if (value && !isEncrypted(value)) {
          updates[field] = encrypt(value);
          hasChanges = true;
        }
      });

      // Mettre à jour si nécessaire
      if (hasChanges) {
        await prisma.user.update({
          where: { id: user.id },
          data: updates,
        });
        usersUpdated++;
        console.log(`  ✅ User #${user.id} (${user.login}) chiffré`);
      }
    }

    console.log(`\n✅ ${usersUpdated}/${users.length} utilisateurs chiffrés\n`);

    console.log('🎉 Chiffrement terminé avec succès !');
    console.log('');
    console.log('📊 Résumé :');
    console.log(`   - Clients chiffrés : ${clientsUpdated}/${clients.length}`);
    console.log(`   - Utilisateurs chiffrés : ${usersUpdated}/${users.length}`);
    console.log('');
    console.log('⚠️  IMPORTANT :');
    console.log('   - Les données sont maintenant chiffrées en AES-256-GCM');
    console.log('   - Sauvegarder ENCRYPTION_KEY en lieu sûr');
    console.log('   - Redémarrer PM2 : pm2 restart mycrm');
  } catch (error) {
    console.error('❌ Erreur lors du chiffrement:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécution
encryptDatabase();
