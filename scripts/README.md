# 📂 Scripts CRM BH Company

> Collection de scripts pour maintenir, surveiller et sécuriser le CRM.

---

## 🔧 Scripts de maintenance

### `safe-rebuild.sh` - Rebuild sécurisé avec vérifications

**Usage** :
```bash
./scripts/safe-rebuild.sh          # Build standard
./scripts/safe-rebuild.sh --clean  # Build propre (supprime .next)
```

**Ce que fait le script** :
1. ✅ Vérifications pré-build (config Tailwind, Pixel ID, etc.)
2. 📦 Backup automatique de .next
3. 🔨 Build Next.js
4. ✅ Vérifications post-build (classes CSS générées)
5. 🔄 Redémarrage PM2
6. 🏥 Test de santé de l'application

**Avantages** :
- Détecte les erreurs AVANT le build
- Backup automatique en cas de problème
- Vérifications post-build pour s'assurer que tout fonctionne

---

### `verify-config.sh` - Vérification de configuration

**Usage** :
```bash
./scripts/verify-config.sh
```

**Ce que vérifie le script** :
- ✅ @config présent dans globals.css (Tailwind v4)
- ✅ tailwind.config.ts existe
- ✅ Pixel ID Facebook correct (pas l'App ID)
- ✅ Google Sheet utilise enrichedData (pas client)
- ✅ API facebook-leads accepte le champ proprietaire
- ✅ Dépendances Tailwind v4 installées

**Exit codes** :
- `0` : Toutes les vérifications passent ✅
- `1` : Au moins une erreur détectée ❌

---

## 📊 Scripts de monitoring

### `startup-checkup.sh` - Diagnostic complet système

**Usage** :
```bash
./scripts/startup-checkup.sh
```

**Ce que fait le script** :
- Lance 5 agents Haiku en parallèle
- Vérifie : PM2, Git, DB, dépendances npm
- Génère un rapport complet
- Coût : ~$0.03 (vs. $0.25 manuellement)

**Résultats** : `/tmp/checkup-*.json`

---

### `view-health.sh` - Santé instantanée

**Usage** :
```bash
./scripts/view-health.sh
```

**Affiche** :
- Score de santé /100
- État PM2 (mémoire, CPU, restarts)
- Espace disque
- État Git
- Taille base de données

---

## 🔄 Scripts automatiques (cron)

### `backup-db.sh` - Backup quotidien DB

**Planification** : Tous les jours à 2h
**Destination** : `/var/www/mycrm/backups/`
**Rétention** : 30 jours

---

### `smart-backup.sh` - Backup intelligent

**Planification** : Tous les jours à 2h
**Fonctionnalités** :
- Backup complet (DB + fichiers)
- Compression automatique
- Rotation automatique (7 jours)

---

### `analyze-optimize.sh` - Analyse et optimisation

**Planification** : Tous les jours à 3h
**Fonctionnalités** :
- Score de santé
- Analyse base de données
- Recommandations d'optimisation
- Rapport stocké dans `/reports/`

---

### `auto-heal.sh` - Auto-réparation

**Planification** : Toutes les 2 minutes
**Fonctionnalités** :
- Détecte les crashes PM2
- Redémarrage automatique
- Alertes si > 5 restarts/heure

---

## 🧪 Scripts de test

### Test lead propriétaire

```bash
curl -X POST http://localhost:3000/api/facebook-leads \
  -H "Content-Type: application/json" \
  -d '{
    "nom": "Test PROPRIO",
    "email": "test@example.com",
    "telephone": "0612345678",
    "codePostal": "13001",
    "departement": "13",
    "proprietaire": "oui"
  }'
```

**Résultat attendu** : `{"success": true, "clientId": XXX}`

---

### Test lead locataire (rejet)

```bash
curl -X POST http://localhost:3000/api/facebook-leads \
  -H "Content-Type: application/json" \
  -d '{
    "nom": "Test LOCATAIRE",
    "email": "test@example.com",
    "telephone": "0612345678",
    "codePostal": "13001",
    "departement": "13",
    "proprietaire": "non"
  }'
```

**Résultat attendu** : `{"error": "Lead rejeté", "reason": "Lead locataire rejeté"}`

---

## 📖 Bonnes pratiques

### Avant un rebuild

```bash
# 1. Vérifier la configuration
./scripts/verify-config.sh

# 2. Si OK, faire le rebuild sécurisé
./scripts/safe-rebuild.sh
```

### Après un changement de code

```bash
# 1. Commit Git
git add .
git commit -m "Description du changement"

# 2. Rebuild + test
./scripts/safe-rebuild.sh

# 3. Push GitHub
git push origin main
```

### En cas de problème

```bash
# 1. Voir les logs
pm2 logs mycrm --lines 100

# 2. Vérifier la santé
./scripts/view-health.sh

# 3. Vérifier la configuration
./scripts/verify-config.sh

# 4. Rebuild propre
./scripts/safe-rebuild.sh --clean
```

---

## 🔒 Sécurité

- ✅ Tous les scripts ont des vérifications d'erreurs
- ✅ Backups automatiques avant rebuild
- ✅ Exit codes standard (0=succès, 1=erreur)
- ✅ Logs détaillés pour debug

---

**Dernière mise à jour** : 16 février 2026
