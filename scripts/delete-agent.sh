#!/bin/bash
# delete-agent.sh — Supprime un agent CRM white-label
# Usage: ./delete-agent.sh <CLIENT_ID> [VPS_HOST]

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <CLIENT_ID> [VPS_HOST]"
    exit 1
fi

CLIENT_ID="$1"
VPS_HOST="${2:-myclaude}"
VPS_USER="${VPS_USER:-root}"
OPENCLAW_DIR="${OPENCLAW_DIR:-/root/.openclaw}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ "$2" != "--force" ]; then
    echo -e "${RED}ATTENTION: Supprimer l'agent $CLIENT_ID ?${NC}"
    echo "Confirmer avec 'yes': "
    read -r CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo "Annulé."
        exit 0
    fi
fi

echo -e "${RED}=== Suppression agent: $CLIENT_ID ===${NC}"

echo -e "${YELLOW}[1/3] Arrêt PM2...${NC}"
ssh "$VPS_USER@$VPS_HOST" "pm2 delete nova-$CLIENT_ID 2>/dev/null || true"

echo -e "${YELLOW}[2/3] Suppression fichiers...${NC}"
ssh "$VPS_USER@$VPS_HOST" "rm -rf $OPENCLAW_DIR/clients/$CLIENT_ID"

echo -e "${YELLOW}[3/3] Nettoyage logs...${NC}"
ssh "$VPS_USER@$VPS_HOST" "rm -f /tmp/nova-$CLIENT_ID.log 2>/dev/null || true"

echo -e "${GREEN}=== Agent $CLIENT_ID supprimé ===${NC}"
