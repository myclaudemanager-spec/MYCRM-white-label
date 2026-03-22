#!/bin/bash

# Wrapper sécurisé pour les commandes Prisma dangereuses
# Force un backup avant toute opération qui peut modifier la DB

DB_PATH="/var/www/mycrm/prisma/prisma/dev.db"
BACKUP_DIR="/var/www/mycrm/backups"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🛡️  COMMANDE PRISMA SÉCURISÉE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -z "$1" ]; then
    echo "❌ Usage: $0 <commande prisma>"
    echo ""
    echo "Exemples :"
    echo "  $0 db:push"
    echo "  $0 migrate:reset"
    echo "  $0 db:seed"
    echo ""
    exit 1
fi

COMMAND="$1"

echo "📋 Commande demandée : npm run $COMMAND"
echo ""

# Compter les clients actuels
CURRENT_CLIENTS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Client;" 2>/dev/null || echo "0")
echo "📊 Clients actuels dans la DB : $CURRENT_CLIENTS"

if [ "$CURRENT_CLIENTS" -gt 0 ]; then
    echo ""
    echo "⚠️  Cette commande peut EFFACER ou MODIFIER la base de données !"
    echo ""
    echo "🔒 BACKUP AUTOMATIQUE OBLIGATOIRE..."

    # Créer un backup de sécurité horodaté
    SAFETY_BACKUP="$BACKUP_DIR/SAFETY_BEFORE_${COMMAND//:/_}_$(date +%Y%m%d_%H%M%S).db.gz"
    gzip -c "$DB_PATH" > "$SAFETY_BACKUP"

    if [ $? -eq 0 ]; then
        BACKUP_SIZE=$(ls -lh "$SAFETY_BACKUP" | awk '{print $5}')
        echo "✅ Backup de sécurité créé : $SAFETY_BACKUP ($BACKUP_SIZE)"
        echo "   → Contient $CURRENT_CLIENTS clients"
    else
        echo "❌ ERREUR : Impossible de créer le backup !"
        echo "❌ COMMANDE ANNULÉE pour sécurité"
        exit 1
    fi
else
    echo "ℹ️  Base de données vide, backup non nécessaire"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
read -p "Continuer avec 'npm run $COMMAND' ? (oui/non) : " CONFIRM
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$CONFIRM" != "oui" ]; then
    echo "❌ Commande annulée par l'utilisateur"
    echo ""
    echo "ℹ️  Le backup de sécurité est conservé : $SAFETY_BACKUP"
    exit 0
fi

echo ""
echo "🔄 Exécution de : npm run $COMMAND"
echo ""

cd /var/www/mycrm
npm run "$COMMAND"

EXIT_CODE=$?

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $EXIT_CODE -eq 0 ]; then
    # Vérifier les clients après
    NEW_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Client;" 2>/dev/null || echo "0")
    echo "📊 Clients après exécution : $NEW_COUNT"

    if [ "$NEW_COUNT" -lt "$CURRENT_CLIENTS" ]; then
        LOST=$((CURRENT_CLIENTS - NEW_COUNT))
        echo ""
        echo "⚠️  ALERTE : $LOST clients perdus !"
        echo "🔧 Pour restaurer :"
        echo "   ./scripts/restore-db.sh $SAFETY_BACKUP"
    elif [ "$NEW_COUNT" -eq "$CURRENT_CLIENTS" ]; then
        echo "✅ Aucune perte de données"
    else
        GAINED=$((NEW_COUNT - CURRENT_CLIENTS))
        echo "✅ Clients ajoutés : +$GAINED"
    fi

    echo "✅ Commande exécutée avec succès"
else
    echo "❌ La commande a échoué (code $EXIT_CODE)"
    echo "✅ Le backup de sécurité est disponible : $SAFETY_BACKUP"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
