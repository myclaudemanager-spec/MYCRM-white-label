#!/bin/bash

# Script de restauration de la base SQLite du CRM
# Usage: ./restore-db.sh [fichier_backup.db.gz]

DB_PATH="/var/www/mycrm/prisma/prisma/dev.db"
BACKUP_DIR="/var/www/mycrm/backups"

# Vérifier qu'un argument est fourni
if [ $# -eq 0 ]; then
    echo "❌ Erreur: Aucun fichier de backup spécifié"
    echo ""
    echo "Usage: $0 <fichier_backup.db.gz>"
    echo ""
    echo "Backups disponibles:"
    ls -lh "$BACKUP_DIR"/crm_backup_*.db.gz 2>/dev/null | tail -10
    exit 1
fi

BACKUP_FILE="$1"

# Vérifier que le fichier existe
if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Erreur: Le fichier $BACKUP_FILE n'existe pas"
    exit 1
fi

echo "⚠️  ATTENTION: Cette opération va remplacer la base de données actuelle!"
echo "Base actuelle: $DB_PATH"
echo "Backup source: $BACKUP_FILE"
echo ""
read -p "Êtes-vous sûr de vouloir continuer? (tapez 'OUI' pour confirmer): " confirmation

if [ "$confirmation" != "OUI" ]; then
    echo "❌ Restauration annulée"
    exit 0
fi

echo ""
echo "🔄 Début de la restauration..."

# Arrêter l'application PM2
echo "1. Arrêt de l'application PM2..."
pm2 stop mycrm

# Créer un backup de sécurité de la base actuelle
if [ -f "$DB_PATH" ]; then
    SAFETY_BACKUP="$BACKUP_DIR/safety_backup_$(date +%Y%m%d_%H%M%S).db"
    echo "2. Création d'un backup de sécurité: $SAFETY_BACKUP"
    cp "$DB_PATH" "$SAFETY_BACKUP"
fi

# Décompresser et restaurer
echo "3. Restauration du backup..."
gunzip -c "$BACKUP_FILE" > "$DB_PATH"

if [ $? -eq 0 ]; then
    echo "✅ Restauration réussie!"
    echo ""
    echo "4. Redémarrage de l'application..."
    pm2 start mycrm
    echo ""
    echo "✨ Base de données restaurée avec succès"
    echo "📁 Backup de sécurité conservé: $SAFETY_BACKUP"
    exit 0
else
    echo "❌ ERREUR lors de la restauration"
    if [ ! -z "$SAFETY_BACKUP" ]; then
        echo "Restauration du backup de sécurité..."
        cp "$SAFETY_BACKUP" "$DB_PATH"
    fi
    pm2 start mycrm
    exit 1
fi
