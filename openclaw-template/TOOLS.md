# TOOLS.md — Outils et configurations agent CRM

## Outils disponibles

### CRM (lecture/écriture)
- **Prisma/SQLite** : Base de données client
- Requêtes SQL directes pour速度和précision

### API endpoints
- `GET /api/clients` : Liste des clients (limit, offset, filters)
- `GET /api/clients/:id` : Détail client
- `POST /api/clients` : Créer client
- `PATCH /api/clients/:id` : Modifier client
- `GET /api/stats/pipeline` : Stats pipeline

### Communication
- **Telegram** : notifications et interactions patron
- **SSH** : accès aux autres services si nécessaire

## Outils NON disponibles

- Git/npm sans autorisation explicite
- Accès à d'autres bases de données clients
- Création de cron jobs
- Modification des fichiers système

## Logs

- PM2 pour les logs du gateway
- Logs gateway: `pm2 logs nova-{CLIENT_ID}`
- Rotate: automatique par PM2

## Monitoring santé

- `curl http://127.0.0.1:{PORT}/health` — gateway OK
- `pm2 list` — statut des processus
- `ss -tlnp | grep {PORT}` — port en écoute
