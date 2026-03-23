#!/bin/bash
# setup-ssl.sh — Configure HTTPS avec Let's Encrypt pour un domaine white-label
# Usage: ./setup-ssl.sh <domain> [email]
# Exemple: ./setup-ssl.sh acme.mycrm.solar coohen26@gmail.com

set -e

DOMAIN="$1"
EMAIL="${2:-coohen26@gmail.com}"

if [ -z "$DOMAIN" ]; then
    echo "Usage: $0 <domain> [email]"
    exit 1
fi

echo "=== SSL Setup pour $DOMAIN ==="

# 1. Vérifier que le DNS pointe bien vers ce serveur
IP=$(dig +short "$DOMAIN" | tail -1)
SERVER_IP="76.13.49.161"  # mycrm VPS — adjust if different

if [ "$IP" != "$SERVER_IP" ]; then
    echo "ERREUR: $DOMAIN ne pointe pas vers $SERVER_IP (actuel: $IP)"
    exit 1
fi

# 2. Remplacer le placeholder dans la config nginx
CONFIG="/etc/nginx/sites-available/mycrm-whitelabel"
sed -i "s/YOUR_DOMAIN/$DOMAIN/g" "$CONFIG"

# 3. Activer le site
ln -sf "$CONFIG" /etc/nginx/sites-enabled/ 2>/dev/null || true

# 4. Reload nginx
nginx -t && systemctl reload nginx

# 5. Certbot
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$EMAIL" --redirect

echo "=== HTTPS OK: https://$DOMAIN ==="
