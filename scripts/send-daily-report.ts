#!/usr/bin/env tsx
/**
 * 📊 RAPPORT QUOTIDIEN AUTOMATIQUE
 * À exécuter tous les jours à 8h via cron
 */

import { sendDailyReport } from '../src/lib/telegram-notifications';

(async () => {
  console.log('📊 Envoi rapport quotidien...');

  const success = await sendDailyReport();

  if (success) {
    console.log('✅ Rapport quotidien envoyé !');
  } else {
    console.error('❌ Échec envoi rapport quotidien');
  }

  process.exit(success ? 0 : 1);
})();
