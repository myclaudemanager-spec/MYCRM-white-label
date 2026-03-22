# OpenClaw CRM Agent Template

Template pour provisionner un agent CRM OpenClaw pour un client white-label.

## Utilisation

```bash
./scripts/provision-agent.sh <CLIENT_ID> <ADMIN_NAME> <ADMIN_TELEGRAM_ID> [VPS_HOST]
```

Exemple:
```bash
./scripts/provision-agent.sh acme "Jean Dupont" 611067700 myclaude
```

## Fichiers template

| Fichier | Description |
|---------|-------------|
| `IDENTITY.md` | Identité de l'agent (nom, rôle, stack LLM) |
| `SOUL.md` | Personnalité et règles de comportement |
| `HEARTBEAT.md` | Checkpoint heartbeat |
| `USER.md` | Profil de l'administrateur |
| `AGENTS.md` | Règles générales des agents |
| `TOOLS.md` | Outils et configurations |

## Variables (remplacées automatiquement)

| Variable | Description |
|----------|-------------|
| `{{BUSINESS_NAME}}` | Nom de l'entreprise du client |
| `{{AGENT_NAME}}` | Nom de l'agent (ex: AcmeAgent) |
| `{{ADMIN_NAME}}` | Nom de l'administrateur |
| `{{ADMIN_TELEGRAM_ID}}` | ID Telegram de l'admin |
| `{{CRM_DB_PATH}}` | Chemin vers la DB SQLite du CRM |
| `{{BUSINESS_DOMAIN}}` | Domaine du client |
| `{{PORT}}` | Port du gateway OpenClaw |
| `{{TIMEZONE}}` | Fuseau horaire du client |
| `{{DATE}}` | Date de déploiement |

## Étapes après provisionnement

1. **Bot Telegram** : Créer via @BotFather et ajouter le token
2. **API Keys** : Configurer DEEPSEEK_API_KEY et GEMINI_API_KEY
3. **CRM** : Configurer NOVA_GATEWAY_TOKEN et NOVA_GATEWAY_PORT dans .env
4. **Test** : `curl http://127.0.0.1:{PORT}/health`

## Suppression

```bash
./scripts/delete-agent.sh <CLIENT_ID> [VPS_HOST]
```
