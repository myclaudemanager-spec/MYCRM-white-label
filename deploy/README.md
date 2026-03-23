# Deploy — Infrastructure VPS

## nginx

### Fichier : `nginx-whitelabel.conf`
Configuration nginx pour instance white-label.
- Proxy vers `http://127.0.0.1:3010` (port configurable via `PORT=` dans .env)
- SSL avec Certbot (Let's Encrypt)
- Headers de sécurité standards

### Installation sur VPS

```bash
# 1. Copier la config
sudo cp nginx-whitelabel.conf /etc/nginx/sites-available/mycrm-whitelabel

# 2. Remplacer YOUR_DOMAIN par le domaine réel
sudo sed -i 's/YOUR_DOMAIN/acme.mycrm.solar/g' /etc/nginx/sites-available/mycrm-whitelabel

# 3. Activer le site
sudo ln -sf /etc/nginx/sites-available/mycrm-whitelabel /etc/nginx/sites-enabled/

# 4. Tester et reload
sudo nginx -t && sudo systemctl reload nginx

# 5. SSL (domain doit déjà pointer vers le VPS)
sudo certbot --nginx -d acme.mycrm.solar --non-interactive --agree-tos --email coohen26@gmail.com --redirect
```

### Script automatisé : `setup-ssl.sh`

```bash
chmod +x setup-ssl.sh
./setup-ssl.sh acme.mycrm.solar coohen26@gmail.com
```

## DNS

Ajouter un enregistrement A sur le registrar :
- **Type** : A
- **Nom** : sous-domaine (ex: `acme`)
- **Contenu** : IP du VPS (ex: `76.13.49.161`)
- **TTL** : 300 (ou minimum)

Attendre propagation DNS (~quelques minutes à 24h).

## Structure white-label sur VPS

```
/var/www/mycrm-whitelabel/     # Code Next.js
/var/www/mycrm/                # MyCRM original (port 3000)

/etc/nginx/sites-available/mycrm-whitelabel
/etc/nginx/sites-enabled/mycrm-whitelabel →

/root/.nvm/versions/node/v24.13.1/bin/pm2
```

## Ports par défaut

| Service | Port |
|---------|------|
| MyCRM original | 3000 |
| White-label #1 | 3010 |
| White-label #N | 3000+N |
