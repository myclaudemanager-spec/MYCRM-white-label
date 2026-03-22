#!/bin/bash

# Script d'analyse et optimisation automatique du CRM
# Exécuté quotidiennement pour maintenir le système en santé optimale

# Configuration
CRM_DIR="/var/www/mycrm"
REPORT_DIR="$CRM_DIR/reports"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$REPORT_DIR/health_report_$TIMESTAMP.txt"
LATEST_REPORT="$REPORT_DIR/latest_health_report.txt"

# Créer le dossier de rapports
mkdir -p "$REPORT_DIR"

# Fonction de log
log() {
    echo "$1" | tee -a "$REPORT_FILE"
}

# Header du rapport
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "🔍 RAPPORT D'ANALYSE ET OPTIMISATION - CRM BH COMPANY"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Date: $(date '+%Y-%m-%d %H:%M:%S')"
log ""

# ============================================
# 1. ANALYSE DE L'APPLICATION
# ============================================
log "1️⃣ ÉTAT DE L'APPLICATION"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Vérifier PM2
PM2_STATUS=$(pm2 jlist | jq -r '.[0].pm2_env.status' 2>/dev/null || echo "unknown")
PM2_UPTIME=$(pm2 jlist | jq -r '.[0].pm2_env.pm_uptime' 2>/dev/null || echo "0")
PM2_RESTARTS=$(pm2 jlist | jq -r '.[0].pm2_env.restart_time' 2>/dev/null || echo "0")
PM2_MEMORY=$(pm2 jlist | jq -r '.[0].monit.memory' 2>/dev/null || echo "0")
PM2_CPU=$(pm2 jlist | jq -r '.[0].monit.cpu' 2>/dev/null || echo "0")

if [ "$PM2_STATUS" = "online" ]; then
    log "✅ Application: En ligne"
    UPTIME_HOURS=$(( ($(date +%s) - $PM2_UPTIME/1000) / 3600 ))
    log "   Uptime: ${UPTIME_HOURS}h"
    log "   Redémarrages: $PM2_RESTARTS"

    # Alerte si trop de redémarrages
    if [ "$PM2_RESTARTS" -gt 10 ]; then
        log "⚠️  ATTENTION: Plus de 10 redémarrages détectés"
        log "   → Action recommandée: Vérifier les logs d'erreurs"
    fi
else
    log "❌ Application: HORS LIGNE"
    log "   → Action: Redémarrage en cours..."
    pm2 restart mycrm
fi

# Mémoire
MEMORY_MB=$(( $PM2_MEMORY / 1024 / 1024 ))
log "   Mémoire: ${MEMORY_MB} MB"
if [ "$MEMORY_MB" -gt 200 ]; then
    log "⚠️  ATTENTION: Consommation mémoire élevée"
    log "   → Action recommandée: Redémarrer l'application"
fi

log ""

# ============================================
# 2. ANALYSE DE LA BASE DE DONNÉES
# ============================================
log "2️⃣ BASE DE DONNÉES"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

DB_PATH="$CRM_DIR/prisma/prisma/dev.db"
if [ -f "$DB_PATH" ]; then
    DB_SIZE=$(du -h "$DB_PATH" | cut -f1)
    DB_SIZE_KB=$(du -k "$DB_PATH" | cut -f1)
    log "✅ Base de données: Présente"
    log "   Taille: $DB_SIZE"

    # Alerte si la DB devient trop grosse
    if [ "$DB_SIZE_KB" -gt 10240 ]; then  # Plus de 10 MB
        log "⚠️  ATTENTION: Base de données volumineuse"
        log "   → Action recommandée: Archiver les anciennes données"
    fi

    # Compter les clients
    if command -v sqlite3 &> /dev/null; then
        CLIENT_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Client;" 2>/dev/null || echo "N/A")
        USER_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM User;" 2>/dev/null || echo "N/A")
        CALL_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM CallLog;" 2>/dev/null || echo "N/A")

        log "   Clients: $CLIENT_COUNT"
        log "   Utilisateurs: $USER_COUNT"
        log "   Appels enregistrés: $CALL_COUNT"
    fi
else
    log "❌ Base de données: NON TROUVÉE"
fi

log ""

# ============================================
# 3. OPTIMISATIONS AUTOMATIQUES
# ============================================
log "3️⃣ OPTIMISATIONS EFFECTUÉES"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

OPTIMIZATIONS_DONE=0

# Nettoyer le cache Next.js
if [ -d "$CRM_DIR/.next/cache" ]; then
    CACHE_SIZE=$(du -sh "$CRM_DIR/.next/cache" 2>/dev/null | cut -f1)
    rm -rf "$CRM_DIR/.next/cache"
    log "✅ Cache Next.js nettoyé ($CACHE_SIZE)"
    OPTIMIZATIONS_DONE=$((OPTIMIZATIONS_DONE + 1))
fi

# Nettoyer les vieux logs PM2
if [ -f "$HOME/.pm2/logs/mycrm-error.log" ]; then
    LOG_SIZE=$(du -sh "$HOME/.pm2/logs/mycrm-error.log" 2>/dev/null | cut -f1)
    if [ $(stat -c%s "$HOME/.pm2/logs/mycrm-error.log" 2>/dev/null || echo 0) -gt 1048576 ]; then  # > 1MB
        pm2 flush mycrm
        log "✅ Logs PM2 nettoyés ($LOG_SIZE)"
        OPTIMIZATIONS_DONE=$((OPTIMIZATIONS_DONE + 1))
    fi
fi

# Nettoyer les vieux rapports (garder 30 jours)
OLD_REPORTS=$(find "$REPORT_DIR" -name "health_report_*.txt" -type f -mtime +30 -delete -print | wc -l)
if [ "$OLD_REPORTS" -gt 0 ]; then
    log "✅ $OLD_REPORTS ancien(s) rapport(s) supprimé(s)"
    OPTIMIZATIONS_DONE=$((OPTIMIZATIONS_DONE + 1))
fi

# Optimiser la base de données SQLite
if command -v sqlite3 &> /dev/null && [ -f "$DB_PATH" ]; then
    sqlite3 "$DB_PATH" "VACUUM;" 2>/dev/null && {
        log "✅ Base de données optimisée (VACUUM)"
        OPTIMIZATIONS_DONE=$((OPTIMIZATIONS_DONE + 1))
    }
fi

if [ "$OPTIMIZATIONS_DONE" -eq 0 ]; then
    log "ℹ️  Aucune optimisation nécessaire"
fi

log ""

# ============================================
# 4. ANALYSE DE L'ESPACE DISQUE
# ============================================
log "4️⃣ ESPACE DISQUE"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

DISK_USAGE=$(df -h /var/www | awk 'NR==2 {print $5}' | sed 's/%//')
DISK_AVAIL=$(df -h /var/www | awk 'NR==2 {print $4}')

log "Utilisation: ${DISK_USAGE}%"
log "Disponible: ${DISK_AVAIL}"

if [ "$DISK_USAGE" -gt 80 ]; then
    log "⚠️  ATTENTION: Espace disque faible"
    log "   → Action recommandée: Nettoyer les fichiers inutiles"
elif [ "$DISK_USAGE" -gt 90 ]; then
    log "❌ CRITIQUE: Espace disque critique"
    log "   → Action URGENTE: Libérer de l'espace immédiatement"
else
    log "✅ Espace disque: OK"
fi

log ""

# ============================================
# 5. ANALYSE DES BACKUPS
# ============================================
log "5️⃣ BACKUPS"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

BACKUP_DIR="$CRM_DIR/backups"
if [ -d "$BACKUP_DIR" ]; then
    BACKUP_COUNT=$(find "$BACKUP_DIR" -name "crm_backup_*.db.gz" -type f | wc -l)
    LATEST_BACKUP=$(find "$BACKUP_DIR" -name "crm_backup_*.db.gz" -type f -printf "%T@ %p\n" | sort -rn | head -1 | cut -d' ' -f2-)

    if [ -n "$LATEST_BACKUP" ]; then
        BACKUP_AGE_SECONDS=$(( $(date +%s) - $(stat -c %Y "$LATEST_BACKUP") ))
        BACKUP_AGE_HOURS=$(( $BACKUP_AGE_SECONDS / 3600 ))

        log "✅ Backups: $BACKUP_COUNT fichier(s)"
        log "   Dernier backup: Il y a ${BACKUP_AGE_HOURS}h"

        if [ "$BACKUP_AGE_HOURS" -gt 48 ]; then
            log "⚠️  ATTENTION: Dernier backup trop ancien"
            log "   → Action recommandée: Vérifier le cron job"
        fi
    else
        log "⚠️  Aucun backup trouvé"
    fi
else
    log "❌ Dossier backups non trouvé"
fi

log ""

# ============================================
# 6. FACEBOOK ADS PERFORMANCE (24h)
# ============================================
log "6️⃣ FACEBOOK ADS (24 dernières heures)"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Vérifier si les tokens Facebook sont configurés
if grep -q "FB_ACCESS_TOKEN=\"EAA" "$CRM_DIR/.env" 2>/dev/null; then
    log "✅ Token Facebook configuré"

    # Récupérer les stats via l'API (authentification admin)
    AUTH_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
        -H "Content-Type: application/json" \
        -d '{"login":"ELIEMALEK","password":"admin123"}' 2>/dev/null)

    AUTH_TOKEN=$(echo "$AUTH_RESPONSE" | grep -o '"token":"[^"]*"' | sed 's/"token":"\(.*\)"/\1/')

    if [ -n "$AUTH_TOKEN" ]; then
        # Récupérer les insights des campagnes
        FB_STATS=$(curl -s -X GET "http://localhost:3000/api/facebook-ads/campaigns?period=last_7d" \
            -H "Cookie: auth-token=$AUTH_TOKEN" 2>/dev/null)

        if echo "$FB_STATS" | grep -q '"success":true'; then
            FB_SPEND=$(echo "$FB_STATS" | grep -o '"spend":[0-9.]*' | head -1 | sed 's/"spend":\(.*\)/\1/' || echo "0")
            FB_LEADS=$(echo "$FB_STATS" | grep -o '"leads":[0-9]*' | head -1 | sed 's/"leads":\(.*\)/\1/' || echo "0")
            FB_CPL=$(echo "$FB_STATS" | grep -o '"cpl":[0-9.]*' | head -1 | sed 's/"cpl":\(.*\)/\1/' || echo "0")

            log "   Dépenses (7j): ${FB_SPEND}€"
            log "   Leads (7j): ${FB_LEADS}"

            if [ "${FB_LEADS}" -gt 0 ]; then
                log "   Coût/Lead: ${FB_CPL}€"

                # Alerte si coût par lead > 50€
                if [ $(echo "$FB_CPL > 50" | bc -l 2>/dev/null || echo "0") -eq 1 ]; then
                    log "⚠️  ATTENTION: Coût/lead élevé (> 50€ objectif)"
                    log "   → Action: Optimiser les campagnes dans /analytics/facebook-ads"
                else
                    log "✅ Coût/lead dans l'objectif (< 50€)"
                fi
            else
                log "⚠️  Aucun lead généré sur 7 jours"
            fi
        else
            log "⚠️  Impossible de récupérer les stats (API)"
        fi
    else
        log "⚠️  Authentification API échouée"
    fi
else
    log "⚠️  Token Facebook non configuré"
    log "   → Configurer FB_ACCESS_TOKEN dans .env"
fi

log ""

# ============================================
# 7. RECOMMANDATIONS
# ============================================
log "7️⃣ RECOMMANDATIONS"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RECOMMENDATIONS=0

# Vérifier si le Pixel Facebook est configuré
if ! grep -q "NEXT_PUBLIC_FB_PIXEL_ID=\"[0-9]" "$CRM_DIR/.env" 2>/dev/null; then
    log "💡 Configurer le Facebook Pixel pour tracker les conversions"
    log "   → Ajouter NEXT_PUBLIC_FB_PIXEL_ID dans .env"
    RECOMMENDATIONS=$((RECOMMENDATIONS + 1))
fi

# Vérifier si des clients sans statut
if command -v sqlite3 &> /dev/null && [ -f "$DB_PATH" ]; then
    NO_STATUS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Client WHERE statusCall IS NULL;" 2>/dev/null || echo "0")
    if [ "$NO_STATUS" -gt 0 ]; then
        log "💡 $NO_STATUS client(s) sans statut d'appel"
        log "   → Assigner un statut pour un meilleur suivi"
        RECOMMENDATIONS=$((RECOMMENDATIONS + 1))
    fi
fi

# Vérifier si trop de redémarrages
if [ "$PM2_RESTARTS" -gt 5 ]; then
    log "💡 Application redémarrée $PM2_RESTARTS fois"
    log "   → Vérifier les logs d'erreurs: pm2 logs mycrm --err"
    RECOMMENDATIONS=$((RECOMMENDATIONS + 1))
fi

# Vérifier la mémoire
if [ "$MEMORY_MB" -gt 150 ]; then
    log "💡 Consommation mémoire élevée (${MEMORY_MB} MB)"
    log "   → Envisager un redémarrage quotidien: pm2 restart mycrm"
    RECOMMENDATIONS=$((RECOMMENDATIONS + 1))
fi

if [ "$RECOMMENDATIONS" -eq 0 ]; then
    log "✅ Aucune recommandation - Système optimal !"
fi

log ""

# ============================================
# 8. SCORE DE SANTÉ
# ============================================
log "8️⃣ SCORE DE SANTÉ"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SCORE=100

# Pénalités
[ "$PM2_STATUS" != "online" ] && SCORE=$((SCORE - 30))
[ "$PM2_RESTARTS" -gt 10 ] && SCORE=$((SCORE - 10))
[ "$MEMORY_MB" -gt 200 ] && SCORE=$((SCORE - 5))
[ "$DISK_USAGE" -gt 80 ] && SCORE=$((SCORE - 10))
[ "$DISK_USAGE" -gt 90 ] && SCORE=$((SCORE - 20))
[ "$BACKUP_AGE_HOURS" -gt 48 ] && SCORE=$((SCORE - 15))
[ "$RECOMMENDATIONS" -gt 3 ] && SCORE=$((SCORE - 10))

if [ "$SCORE" -ge 95 ]; then
    log "🌟 Score: $SCORE/100 - EXCELLENT"
elif [ "$SCORE" -ge 85 ]; then
    log "✅ Score: $SCORE/100 - BON"
elif [ "$SCORE" -ge 70 ]; then
    log "⚠️  Score: $SCORE/100 - MOYEN"
else
    log "❌ Score: $SCORE/100 - CRITIQUE"
fi

log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "✨ Analyse terminée avec $OPTIMIZATIONS_DONE optimisation(s) effectuée(s)"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Copier vers latest_health_report.txt
cp "$REPORT_FILE" "$LATEST_REPORT"

# Envoyer une alerte si score critique
if [ "$SCORE" -lt 70 ]; then
    log ""
    log "⚠️  ALERTE: Score de santé critique ($SCORE/100)"
    log "→ Action requise: Vérifier le système immédiatement"
fi

exit 0
