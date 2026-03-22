#!/bin/bash
# provision-agent.sh — Provisionne un agent CRM OpenClaw pour client white-label
# Usage: ./provision-agent.sh <CLIENT_ID> <ADMIN_NAME> <ADMIN_TELEGRAM_ID> [VPS_HOST]
#
# Exemple: ./provision-agent.sh acme "Jean Dupont" 611067700 myclaude

set -e

if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    echo "Usage: $0 <CLIENT_ID> <ADMIN_NAME> <ADMIN_TELEGRAM_ID> [VPS_HOST]"
    echo ""
    echo "Provisionne un agent CRM OpenClaw pour client white-label."
    echo "Le script va demander le port et vérifier sa disponibilité."
    exit 1
fi

CLIENT_ID="$1"
ADMIN_NAME="$2"
ADMIN_TELEGRAM_ID="$3"
VPS_HOST="${4:-myclaude}"
VPS_USER="${VPS_USER:-root}"
OPENCLAW_DIR="${OPENCLAW_DIR:-/root/.openclaw}"
TEMPLATE_DIR="${TEMPLATE_DIR:-$(pwd)/openclaw-template}"
DATE="$(date +%Y-%m-%d)"

# Ports: 18791, 18792, 18793...
BASE_PORT=18791
PORT="${5:-$BASE_PORT}"

# Trouver un port libre
while ssh "$VPS_USER@$VPS_HOST" "ss -tlnp 2>/dev/null | grep -q ':$PORT '" 2>/dev/null; do
    echo "Port $PORT occupé, essai $((PORT + 1))..."
    PORT=$((PORT + 1))
done

AGENT_NAME="${CLIENT_ID^}Agent"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Provisioning agent: $CLIENT_ID ===${NC}"
echo "  Port: $PORT"
echo "  VPS: $VPS_HOST"

# 1. Créer répertoire workspace
echo -e "${YELLOW}[1/5] Création workspace...${NC}"
ssh "$VPS_USER@$VPS_HOST" "mkdir -p $OPENCLAW_DIR/clients/$CLIENT_ID"

# 2. Copier template
echo -e "${YELLOW}[2/5] Copie template...${NC}"
ssh "$VPS_USER@$VPS_HOST" "rm -rf $OPENCLAW_DIR/clients/$CLIENT_ID/*"
scp -r "$TEMPLATE_DIR/." "$VPS_USER@$VPS_HOST:$OPENCLAW_DIR/clients/$CLIENT_ID/"

# 3. Remplacer variables via Python
echo -e "${YELLOW}[3/5] Remplacement variables...${NC}"
ssh "$VPS_USER@$VPS_HOST" << PYEOF
cd $OPENCLAW_DIR/clients/$CLIENT_ID
python3 << 'PYTHON'
import os, re

replacements = {
    '{{BUSINESS_NAME}}': os.environ.get('BUSINESS_NAME', '$CLIENT_ID'),
    '{{AGENT_NAME}}': os.environ.get('AGENT_NAME', '$AGENT_NAME'),
    '{{ADMIN_NAME}}': os.environ.get('ADMIN_NAME', '$ADMIN_NAME'),
    '{{ADMIN_TELEGRAM_ID}}': os.environ.get('ADMIN_TELEGRAM_ID', '$ADMIN_TELEGRAM_ID'),
    '{{CRM_DB_PATH}}': os.environ.get('CRM_DB_PATH', '/var/www/mycrm-\$CLIENT_ID/prisma/prod.db'),
    '{{BUSINESS_DOMAIN}}': os.environ.get('BUSINESS_DOMAIN', '\$CLIENT_ID.example.com'),
    '{{DATE}}': os.environ.get('DATE', '$DATE'),
    '{{TIMEZONE}}': os.environ.get('TIMEZONE', 'Europe/Paris'),
    '{{PORT}}': os.environ.get('PORT', '$PORT'),
    '{{COMMUNICATION_CONFIG}}': os.environ.get('COMMUNICATION_CONFIG', '# Pas de communication externe configurée'),
}

for root, dirs, files in os.walk('.'):
    for f in files:
        if f.endswith('.md') or f.endswith('.json'):
            fp = os.path.join(root, f)
            with open(fp, 'r') as file:
                content = file.read()
            for old, new in replacements.items():
                content = content.replace(old, new)
            with open(fp, 'w') as file:
                file.write(content)
print("Variables remplacées")
PYTHON
PYEOF

# 4. Générer gateway token
GW_TOKEN="nova-gw-$(openssl rand -hex 12 2>/dev/null || cat /dev/urandom | tr -dc 'a-f0-9' | head -c 24)"

echo -e "${YELLOW}[4/5] Configuration openclaw.json (port $PORT)...${NC}"
ssh "$VPS_USER@$VPS_HOST" "cat > $OPENCLAW_DIR/clients/$CLIENT_ID/openclaw.json << JSONEOF"
{
  "gateway": {
    "port": $PORT,
    "token": "$GW_TOKEN",
    "allowLoopback": true
  },
  "models": [
    {
      "name": "deepseek/deepseek-chat",
      "provider": "openai",
      "apiKey": "\${DEEPSEEK_API_KEY}",
      "thinkingDefault": "high"
    },
    {
      "name": "google/gemini-2.5-flash",
      "provider": "google",
      "apiKey": "\${GEMINI_API_KEY}"
    }
  ],
  "dmPolicy": "allowlist",
  "allowFrom": ["$ADMIN_TELEGRAM_ID"],
  "plugins": {
    "spec": "@ollama/openclaw-web-search@0.2.2"
  }
}
JSONEOF"

# 5. Démarrer PM2
echo -e "${YELLOW}[5/5] Démarrage PM2...${NC}"
ssh "$VPS_USER@$VPS_HOST" "pm2 delete nova-$CLIENT_ID 2>/dev/null || true"
ssh "$VPS_USER@$VPS_HOST" "cd $OPENCLAW_DIR/clients/$CLIENT_ID && pm2 start 'openclaw gateway --config openclaw.json' --name 'nova-$CLIENT_ID' --wait-ready --listen-timeout 15000 2>&1 || echo 'PM2 start attempted'"

echo ""
echo -e "${GREEN}=== Agent $CLIENT_ID prêt ===${NC}"
echo ""
echo "=== Config à compléter sur le VPS ==="
echo "  Fichier: $OPENCLAW_DIR/clients/$CLIENT_ID/openclaw.json"
echo "  - Ajouter DEEPSEEK_API_KEY et GEMINI_API_KEY dans l'environnement"
echo "  - Créer bot Telegram: @BotFather → /newbot"
echo "  - Ajouter TELEGRAM_BOT_TOKEN dans openclaw.json"
echo ""
echo "=== Config à ajouter dans .env du CRM ==="
echo "  NOVA_ENABLED=true"
echo "  NOVA_GATEWAY_TOKEN=$GW_TOKEN"
echo "  NOVA_GATEWAY_PORT=$PORT"
echo ""
echo "=== Commandes utiles ==="
echo "  ssh $VPS_USER@$VPS_HOST 'pm2 logs nova-$CLIENT_ID'"
echo "  ssh $VPS_USER@$VPS_HOST 'pm2 restart nova-$CLIENT_ID'"
echo "  ssh $VPS_USER@$VPS_HOST 'curl http://127.0.0.1:$PORT/health'"
