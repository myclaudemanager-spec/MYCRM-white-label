#!/bin/bash
# delete-client.sh — Supprime un client CRM white-label
# Usage: ./delete-client.sh <CLIENT_ID> [--force]
#
# Exemple: ./delete-client.sh acme
#   → Supprime mycrm-acme, DB, PM2, et fichiers

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <CLIENT_ID> [--force]"
    echo ""
    echo "Supprime définitivement un client CRM white-label."
    echo " ATTENTION: Cette action est IRRÉVERSIBLE."
    echo ""
    echo "Options:"
    echo "  --force   Supprime sans confirmation"
    echo ""
    exit 1
fi

CLIENT_ID="$1"
FORCE="$2"
VPS_HOST="${VPS_HOST:-mycrm}"
VPS_USER="${VPS_USER:-root}"
DATA_DIR="${DATA_DIR:-/var/www}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Confirmation
if [ "$FORCE" != "--force" ]; then
    echo -e "${RED}ATTENTION: Vous êtes sur le point de supprimer le client $CLIENT_ID${NC}"
    echo -e "${RED}         Toutes les données seront PERDUES DÉFINITIVEMENT.${NC}"
    echo ""
    echo -e "${YELLOW}Êtes-vous sûr ? Tapez 'yes' pour confirmer:${NC}"
    read -r CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo "Annulé."
        exit 0
    fi
fi

echo -e "${RED}=== Suppression du client: $CLIENT_ID ===${NC}"

# 1. Arrêter PM2
echo -e "${YELLOW}[1/4] Arrêt PM2...${NC}"
ssh "$VPS_USER@$VPS_HOST" "pm2 delete mycrm-$CLIENT_ID 2>/dev/null || true"

# 2. Supprimer les fichiers
echo -e "${YELLOW}[2/4] Suppression des fichiers...${NC}"
ssh "$VPS_USER@$VPS_HOST" "rm -rf $DATA_DIR/mycrm-$CLIENT_ID"

# 3. Supprimer les backups DB (s'il y en a)
echo -e "${YELLOW}[3/4] Nettoyage backups...${NC}"
ssh "$VPS_USER@$VPS_HOST" "rm -f /tmp/mycrm-$CLIENT_ID-backup-*.db 2>/dev/null || true"
ssh "$VPS_USER@$VPS_HOST" "rm -f /var/www/backups/mycrm-$CLIENT_ID-*.tar.gz 2>/dev/null || true"

# 4. Supprimer config nginx (si elle existe)
echo -e "${YELLOW}[4/4] Suppression config nginx...${NC}"
ssh "$VPS_USER@$VPS_HOST" "rm -f /etc/nginx/sites-available/mycrm-$CLIENT_ID 2>/dev/null || true"
ssh "$VPS_USER@$VPS_HOST" "rm -f /etc/nginx/sites-enabled/mycrm-$CLIENT_ID 2>/dev/null || true"
ssh "$VPS_USER@$VPS_HOST" "nginx -t 2>/dev/null && nginx -s reload 2>/dev/null || true"

echo ""
echo -e "${GREEN}=== Client $CLIENT_ID supprimé ===${NC}"
