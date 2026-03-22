#!/bin/bash
# Auto-healing MyCRM - Surveillance et réparation automatique
# Exécuté toutes les 2 minutes via cron

LOG="/var/www/mycrm/logs/auto-heal.log"
ALERT_LOG="/var/www/mycrm/logs/auto-heal-alerts.log"

# 1. Check PM2 mycrm
if ! pm2 jlist 2>/dev/null | grep -q '"name":"mycrm".*"status":"online"'; then
  echo "[$(date)] 🔴 mycrm DOWN → restart" | tee -a $LOG $ALERT_LOG
  pm2 restart mycrm 2>&1 >> $LOG
else
  echo "[$(date)] ✅ mycrm online" >> $LOG
fi

# 2. Check PM2 telegram-bot
if ! pm2 jlist 2>/dev/null | grep -q '"name":"telegram-bot".*"status":"online"'; then
  echo "[$(date)] 🔴 telegram-bot DOWN → restart" | tee -a $LOG $ALERT_LOG
  pm2 restart telegram-bot 2>&1 >> $LOG
else
  echo "[$(date)] ✅ telegram-bot online" >> $LOG
fi

# 3. Check port 3000 (Next.js)
if ! curl -sf http://localhost:3000 > /dev/null 2>&1; then
  echo "[$(date)] 🔴 Port 3000 DOWN → restart mycrm" | tee -a $LOG $ALERT_LOG
  pm2 restart mycrm 2>&1 >> $LOG
  sleep 5
  if curl -sf http://localhost:3000 > /dev/null 2>&1; then
    echo "[$(date)] ✅ Port 3000 restauré" | tee -a $LOG
  fi
else
  echo "[$(date)] ✅ Port 3000 OK" >> $LOG
fi

# 4. Check disk space
DISK=$(df -h / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK" -gt 85 ]; then
  echo "[$(date)] 🟠 Disque plein (${DISK}%) → nettoyage" | tee -a $LOG $ALERT_LOG
  rm -rf /var/www/mycrm/.next/cache/* 2>/dev/null
  find /var/www/mycrm/logs -name "*.log" -mtime +7 -delete 2>/dev/null
  DISK_AFTER=$(df -h / | tail -1 | awk '{print $5}' | sed 's/%//')
  echo "[$(date)] ✅ Nettoyage terminé - Disque : ${DISK_AFTER}%" | tee -a $LOG
else
  echo "[$(date)] ✅ Disque OK (${DISK}%)" >> $LOG
fi

# 5. Check DB integrity
if ! sqlite3 /var/www/mycrm/prisma/prisma/dev.db "PRAGMA integrity_check;" 2>/dev/null | grep -q "ok"; then
  echo "[$(date)] 🔴 DB corrompue → restore backup" | tee -a $LOG $ALERT_LOG
  LAST_BACKUP=$(ls -t /var/www/mycrm/backups/full/db_*.db 2>/dev/null | head -1)
  if [ -n "$LAST_BACKUP" ]; then
    cp $LAST_BACKUP /var/www/mycrm/prisma/prisma/dev.db
    echo "[$(date)] ✅ DB restaurée depuis backup" | tee -a $LOG
  fi
else
  echo "[$(date)] ✅ DB OK" >> $LOG
fi

# 6. Check mémoire
MEM=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
if [ "$MEM" -gt 90 ]; then
  echo "[$(date)] 🟠 Mémoire élevée (${MEM}%) → restart services" | tee -a $LOG $ALERT_LOG
  pm2 restart all 2>&1 >> $LOG
else
  echo "[$(date)] ✅ Mémoire OK (${MEM}%)" >> $LOG
fi

# 7. Détection erreur cache Next.js (client reference manifest)
REBUILD_LOCK="/var/www/mycrm/.next-rebuild.lock"
if pm2 logs mycrm --lines 100 --nostream 2>/dev/null | grep -q "client reference manifest.*does not exist"; then
  if [ ! -f "$REBUILD_LOCK" ]; then
    echo "[$(date)] 🟠 Next.js manifest corrompu → rebuild + restart" | tee -a $LOG $ALERT_LOG
    touch "$REBUILD_LOCK"
    cd /var/www/mycrm
    rm -rf .next/cache 2>/dev/null
    /root/.nvm/versions/node/v24.13.1/bin/npm run build >> $LOG 2>&1
    BUILD_EXIT=$?
    if [ $BUILD_EXIT -eq 0 ]; then
      /root/.nvm/versions/node/v24.13.1/bin/pm2 restart mycrm 2>&1 >> $LOG
      echo "[$(date)] ✅ Rebuild Next.js réussi → mycrm redémarré" | tee -a $LOG
    else
      echo "[$(date)] 🔴 Rebuild Next.js échoué (exit $BUILD_EXIT)" | tee -a $LOG $ALERT_LOG
    fi
    rm -f "$REBUILD_LOCK"
  else
    echo "[$(date)] ⏳ Rebuild déjà en cours (lock file présent)" >> $LOG
  fi
else
  echo "[$(date)] ✅ Next.js manifests OK" >> $LOG
fi

echo "[$(date)] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >> $LOG
