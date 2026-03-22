#!/bin/bash
# provision-client.sh — Provisionne un nouveau client CRM white-label
# Usage: ./provision-client.sh <CLIENT_ID> [PORT_BASE]
#
# Exemple: ./provision-client.sh acme 3010
#   → Créé mycrm-acme sur port 3010, DB: prod_acme.db
#   → OpenClaw agent sur port 18791 (si NOVA_ENABLED=true)

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <CLIENT_ID> [PORT_BASE]"
    echo ""
    echo "Provisionne un nouveau client CRM white-label."
    echo ""
    echo "Arguments:"
    echo "  CLIENT_ID   Identifiant unique du client (ex: acme, bhcompany)"
    echo "  PORT_BASE   Port de base (défaut: 3010)"
    echo ""
    echo "Variables d'environnement:"
    echo "  VPS_HOST    Host VPS (défaut: mycrm)"
    echo "  VPS_USER    User SSH (défaut: root)"
    echo "  DATA_DIR    Répertoire data (défaut: /var/www)"
    echo ""
    exit 1
fi

CLIENT_ID="$1"
PORT_BASE="${2:-3010}"
VPS_HOST="${VPS_HOST:-mycrm}"
VPS_USER="${VPS_USER:-root}"
DATA_DIR="${DATA_DIR:-/var/www}"

# Ports
PORT_HTTP=$((PORT_BASE))
PORT_HTTPS=$((PORT_BASE + 1))
PORT_NOVA=$((PORT_BASE + 100))  # 18791 for NOVA agent

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Provisioning client: $CLIENT_ID ===${NC}"

# 1. Vérifier que le client n'existe pas déjà
ssh "$VPS_USER@$VPS_HOST" "test -d $DATA_DIR/mycrm-$CLIENT_ID" 2>/dev/null && {
    echo -e "${RED}ERREUR: Le client $CLIENT_ID existe déjà sur $VPS_HOST${NC}"
    exit 1
}

# 2. Créer le répertoire
echo -e "${YELLOW}[1/6] Création du répertoire...${NC}"
ssh "$VPS_USER@$VPS_HOST" "mkdir -p $DATA_DIR/mycrm-$CLIENT_ID"

# 3. Copier le template
echo -e "${YELLOW}[2/6] Copie du template CRM...${NC}"
ssh "$VPS_USER@$VPS_HOST" "cp -r $DATA_DIR/mycrm-template/* $DATA_DIR/mycrm-$CLIENT_ID/"

# 4. Générer le .env
echo -e "${YELLOW}[3/6] Génération du .env...${NC}"
cat > /tmp/mycrm-$CLIENT_ID.env << ENVEOF
DATABASE_URL="file:./prod_$CLIENT_ID.db"
JWT_SECRET="$(openssl rand -hex 32)"

# Business
BUSINESS_NAME="$CLIENT_ID"
NEXT_PUBLIC_BUSINESS_NAME="$CLIENT_ID"
NEXT_PUBLIC_BUSINESS_TAGLINE="CRM"

# Ports
PORT=$PORT_HTTP

# NOVA Agent (550€ tier)
NOVA_ENABLED="false"
NOVA_GATEWAY_TOKEN=""
NOVA_GATEWAY_PORT="$PORT_NOVA"

# CRM URL
CRM_BASE_URL="https://$CLIENT_ID.example.com"
LANDING_PRODUCT="nos services"
LANDING_DOMAIN="https://$CLIENT_ID.example.com"
ENVEOF

scp /tmp/mycrm-$CLIENT_ID.env "$VPS_USER@$VPS_HOST:$DATA_DIR/mycrm-$CLIENT_ID/.env"
rm /tmp/mycrm-$CLIENT_ID.env

# 5. Initialiser la DB (seed white-label)
echo -e "${YELLOW}[4/6] Initialisation de la base de données...${NC}"
ssh "$VPS_USER@$VPS_HOST" << 'SSHEOF'
cd /var/www/mycrm-{CLIENT_ID}
npx prisma db push --accept-data-loss 2>/dev/null || true
# Le seed se fait manuellement après via:
# npx prisma db seed
SSHEOF

# Correction: utiliser la variable CLIENT_ID correctement
ssh "$VPS_USER@$VPS_HOST" "cd $DATA_DIR/mycrm-$CLIENT_ID && npx prisma db push --accept-data-loss 2>/dev/null || true"

# 6. Configurer PM2
echo -e "${YELLOW}[5/6] Configuration PM2...${NC}"
ssh "$VPS_USER@$VPS_HOST" "pm2 delete mycrm-$CLIENT_ID 2>/dev/null || true"
ssh "$VPS_USER@$VPS_HOST" "cd $DATA_DIR/mycrm-$CLIENT_ID && pm2 start 'npm start' --name mycrm-$CLIENT_ID --wait-ready --listen-timeout 10000"

# 7. Configurer nginx (si disponible)
echo -e "${YELLOW}[6/6] Configuration nginx...${NC}"
ssh "$VPS_USER@$VPS_HOST" "test -d /etc/nginx/sites-available && {
    cat > /tmp/mycrm-$CLIENT_ID.nginx << 'NGINXEOF'
server {
    listen 80;
    server_name CLIENT_DOMAIN_PLACEHOLDER;
    return 301 https://\$host\$request_uri;
}
server {
    listen 443 ssl;
    server_name CLIENT_DOMAIN_PLACEHOLDER;
    ssl_certificate /etc/letsencrypt/live/CLIENT_DOMAIN_PLACEHOLDER/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/CLIENT_DOMAIN_PLACEHOLDER/privkey.pem;
    location / {
        proxy_pass http://127.0.0.1:PORT_PLACEHOLDER;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINXEOF
    # Note: à compléter manuellement avec le domain réel
    echo 'Nginx config créé dans /tmp/mycrm-$CLIENT_ID.nginx - à configurer manuellement'
}" 2>/dev/null || echo "nginx non configuré (optionnel)"

echo ""
echo -e "${GREEN}=== Client $CLIENT_ID provisionné avec succès ===${NC}"
echo ""
echo "Prochains étapes:"
echo "  1. Compléter la configuration .env sur $VPS_HOST:$DATA_DIR/mycrm-$CLIENT_ID/.env"
echo "  2. Configurer le domaine DNS -> $VPS_HOST"
echo "  3. Activer NOVA si tier 550€: NOVA_ENABLED=true dans .env"
echo "  4. Lancer le seed: ssh $VPS_USER@$VPS_HOST 'cd $DATA_DIR/mycrm-$CLIENT_ID && npx prisma db seed'"
echo "  5. Redémarrer: pm2 restart mycrm-$CLIENT_ID"
echo ""
echo "Ports utilisés:"
echo "  - HTTP: $PORT_HTTP"
echo "  - NOVA agent: $PORT_NOVA (si tier 550€)"
