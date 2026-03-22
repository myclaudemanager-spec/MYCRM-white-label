#!/bin/bash

# Script de backup quotidien de la base SQLite du CRM (VERSION PROTÉGÉE)
# Exécuté automatiquement chaque jour par cron
# PROTECTION : Refuse de sauvegarder si perte massive de données détectée

# Configuration
DB_PATH="/var/www/mycrm/prisma/prisma/dev.db"
BACKUP_DIR="/var/www/mycrm/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/crm_backup_$TIMESTAMP.db"
LOG_FILE="$BACKUP_DIR/backup.log"
COUNT_FILE="/var/www/mycrm/.client-count.txt"

# Nombre de jours de rétention des backups
RETENTION_DAYS=30

# Seuil de perte acceptable (en %)
LOSS_THRESHOLD=5

# Créer le dossier de backup s'il n'existe pas
mkdir -p "$BACKUP_DIR"

# Fonction de log
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log "========== Début du backup =========="

# Vérifier que la base de données existe
if [ ! -f "$DB_PATH" ]; then
    log "ERREUR: Base de données non trouvée à $DB_PATH"
    exit 1
fi

# Compter les clients actuels
CURRENT_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Client;" 2>/dev/null || echo "0")
log "📊 Clients actuels dans la DB : $CURRENT_COUNT"

# Vérifier s'il y a eu une perte de données
if [ -f "$COUNT_FILE" ]; then
    PREVIOUS_COUNT=$(cat "$COUNT_FILE")
    log "📊 Clients au dernier backup : $PREVIOUS_COUNT"

    if [ "$PREVIOUS_COUNT" -gt 0 ] && [ "$CURRENT_COUNT" -lt "$PREVIOUS_COUNT" ]; then
        LOST=$((PREVIOUS_COUNT - CURRENT_COUNT))
        PERCENT=$(awk "BEGIN {printf \"%.1f\", ($LOST/$PREVIOUS_COUNT)*100}")

        log "⚠️  ALERTE : Perte de $LOST clients détectée ($PERCENT%)"

        # Si perte > seuil, refuser le backup
        if (( $(echo "$PERCENT > $LOSS_THRESHOLD" | bc -l) )); then
            log "❌ BACKUP ANNULÉ : Perte de données > $LOSS_THRESHOLD% détectée !"
            log "❌ Clients perdus : $LOST ($PERCENT%)"
            log "🔒 Le dernier backup valide est conservé"

            # Créer un rapport d'alerte
            ALERT_FILE="$BACKUP_DIR/ALERT_DATA_LOSS_$(date +%Y%m%d_%H%M%S).txt"
            cat > "$ALERT_FILE" <<EOF
⚠️  ALERTE CRITIQUE : PERTE DE DONNÉES DÉTECTÉE ⚠️

Date : $(date '+%Y-%m-%d %H:%M:%S')
Clients avant : $PREVIOUS_COUNT
Clients après : $CURRENT_COUNT
Clients perdus : $LOST
Pourcentage : $PERCENT%

🚨 LE BACKUP AUTOMATIQUE A ÉTÉ ANNULÉ pour ne pas écraser
   les backups valides avec une base de données incomplète.

🔧 ACTIONS RECOMMANDÉES :

1. Vérifier ce qui s'est passé :
   - Commande Prisma exécutée ?
   - Migration de base de données ?
   - Suppression manuelle ?

2. Restaurer depuis le dernier backup valide :
   cd /var/www/mycrm
   ./scripts/restore-db.sh

3. Consulter les logs :
   cat $LOG_FILE

📋 Backups disponibles :
$(ls -lht "$BACKUP_DIR"/crm_backup_*.db.gz | head -5)

EOF

            log "📋 Rapport d'alerte créé : $ALERT_FILE"
            log "========== Backup annulé (protection perte de données) =========="

            # Backup d'urgence de l'état actuel (sans écraser les bons backups)
            EMERGENCY_FILE="$BACKUP_DIR/EMERGENCY_EMPTY_$(date +%Y%m%d_%H%M%S).db.gz"
            gzip -c "$DB_PATH" > "$EMERGENCY_FILE"
            log "⚠️  Backup d'urgence de l'état actuel créé : $EMERGENCY_FILE"

            exit 2
        else
            log "ℹ️  Perte mineure ($PERCENT%), backup autorisé"
        fi
    elif [ "$CURRENT_COUNT" -gt "$PREVIOUS_COUNT" ]; then
        GAINED=$((CURRENT_COUNT - PREVIOUS_COUNT))
        log "✅ Nouveaux clients détectés : +$GAINED"
    fi
fi

# Effectuer le backup
log "Backup de $DB_PATH vers $BACKUP_FILE"
cp "$DB_PATH" "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    # Compresser le backup pour économiser l'espace
    gzip "$BACKUP_FILE"
    BACKUP_FILE="${BACKUP_FILE}.gz"

    # Calculer la taille du backup
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log "✅ Backup réussi: $BACKUP_FILE (taille: $BACKUP_SIZE)"

    # Sauvegarder le nombre de clients pour la prochaine vérification
    echo "$CURRENT_COUNT" > "$COUNT_FILE"

    # Supprimer les backups de plus de X jours (sauf les EMERGENCY et SAFETY)
    log "Nettoyage des backups de plus de $RETENTION_DAYS jours"
    find "$BACKUP_DIR" -name "crm_backup_*.db.gz" -type f -mtime +$RETENTION_DAYS -delete

    # Compter le nombre de backups restants
    BACKUP_COUNT=$(find "$BACKUP_DIR" -name "crm_backup_*.db.gz" -type f | wc -l)
    log "Backups actuels: $BACKUP_COUNT fichier(s)"

    log "========== Backup terminé avec succès =========="
    exit 0
else
    log "❌ ERREUR: Le backup a échoué"
    log "========== Backup terminé avec erreur =========="
    exit 1
fi
