# CRM Mon CRM 🌞

**CRM professionnel pour la gestion commerciale et le suivi clients - Spécialisé panneaux photovoltaïques**

## 📋 Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Configuration](#configuration)
- [Utilisation](#utilisation)
- [Architecture](#architecture)
- [Fonctionnalités](#fonctionnalités)
- [API Endpoints](#api-endpoints)
- [Raccourcis clavier](#raccourcis-clavier)
- [Suivi des conversions](#suivi-des-conversions)
- [Dépannage](#dépannage)

---

## 🎯 Vue d'ensemble

CRM Mon CRM est une application web complète pour gérer :
- **Clients** : Fiches détaillées, historique des interactions
- **Planning** : Gestion des RDV commerciaux
- **Téléprospection** : Panel d'appel intégré avec timer
- **Facturation** : Suivi des devis et factures
- **Équipes** : Gestion des utilisateurs et permissions
- **Reporting** : Statistiques et KPIs en temps réel
- **Suivi conversions** : Facebook Pixel pour optimiser les campagnes

### Technologies

- **Frontend** : Next.js 16.1.6 (App Router) + React 19 + TypeScript
- **Styling** : Tailwind CSS v4
- **Backend** : Next.js API Routes + Middleware
- **Base de données** : SQLite + Prisma ORM
- **Authentification** : JWT + HttpOnly Cookies + bcrypt
- **Déploiement** : PM2 Process Manager
- **Analytics** : Facebook Pixel intégré

---

## ✅ Prérequis

- **Node.js** >= 18.x
- **npm** >= 9.x
- **PM2** (pour la production)
- **SQLite** (inclus avec Node.js)

---

## 🚀 Installation

### 1. Cloner ou copier le projet

```bash
cd /var/www/mycrm
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Générer le client Prisma

```bash
npm run db:generate
```

### 4. Initialiser la base de données

```bash
npm run db:push
```

### 5. Créer les données de test

```bash
npm run db:seed
```

**Compte admin créé :**
- Email : `ELIEMALEK`
- Mot de passe : `admin123`

### 6. Lancer en développement

```bash
npm run dev
```

L'application sera disponible sur `http://localhost:3000`

### 7. Build pour la production

```bash
npm run build
npm start
```

### 8. Déploiement avec PM2

```bash
pm2 start npm --name "mycrm" -- start
pm2 save
pm2 startup
```

---

## ⚙️ Configuration

### Variables d'environnement (`.env`)

```env
# Base de données SQLite
DATABASE_URL="file:./prisma/dev.db"

# JWT Secret (CHANGER EN PRODUCTION)
JWT_SECRET="votre-secret-jwt-securise"

# Facebook Pixel ID (optionnel)
NEXT_PUBLIC_FB_PIXEL_ID="votre-pixel-id"
```

**⚠️ IMPORTANT** : Changez le `JWT_SECRET` en production avec une valeur aléatoire sécurisée.

### Configuration Facebook Pixel

1. Récupérez votre Pixel ID depuis Facebook Business Manager
2. Ajoutez-le dans `.env` : `NEXT_PUBLIC_FB_PIXEL_ID="123456789"`
3. Redémarrez l'application : `pm2 restart mycrm`

---

## 🎨 Utilisation

### Connexion

Rendez-vous sur `http://localhost:3000/login` et connectez-vous avec le compte admin.

### Navigation principale

- **Dashboard** : Vue d'ensemble des KPIs (Ctrl+1)
- **Clients** : Gestion de la base clients (Ctrl+2)
- **Planning** : Calendrier des RDV (Ctrl+3)
- **Factures** : Suivi financier (Ctrl+4)
- **Utilisateurs** : Gestion des équipes (Ctrl+5)
- **Réglages** : Configuration système

### Gestion des clients

#### Créer un client
- Cliquez sur "Nouveau client" ou appuyez sur **Ctrl+N**
- Remplissez les informations obligatoires
- Sauvegardez

#### Appeler un client
- Cliquez sur le numéro de téléphone dans la liste
- Le panel d'appel s'ouvre à droite
- Cliquez sur "Démarrer l'appel" (lance le timer)
- Sélectionnez le résultat de l'appel
- Ajoutez des notes si nécessaire
- Complétez l'appel

#### Filtres sauvegardés
- **Vues rapides** : Filtres épinglés (À rappeler, RDV pris, À confirmer)
- **Autres vues** : Filtres personnalisés
- Créez vos propres vues avec le bouton "+ Sauvegarder vue"
- Épinglez vos vues favorites (survol + icône étoile)

### Statuts clients

**Statut Call (Téléprospection)** :
- NOUVEAU
- À RAPPELER
- NRP (Ne Répond Pas)
- CONFIRMER
- RDV PRIS
- PAS INTÉRESSÉ
- DOUBLON
- HORS CIBLE

**Statut RDV** :
- ATTENTE
- CONFIRMÉ
- EFFECTUÉ
- ANNULÉ
- REPORTÉ
- SIGNÉ COMPLET
- SIGNÉ PARTIEL
- SANS SUITE

---

## 🏗️ Architecture

### Structure des dossiers

```
/var/www/mycrm/
├── prisma/
│   ├── schema.prisma       # Modèle de données
│   ├── seed.ts             # Données de test
│   └── dev.db              # Base SQLite
├── src/
│   ├── app/                # Pages Next.js (App Router)
│   │   ├── api/            # API Routes
│   │   ├── clients/        # Page clients
│   │   ├── dashboard/      # Page dashboard
│   │   ├── login/          # Page connexion
│   │   └── layout.tsx      # Layout principal
│   ├── components/         # Composants React
│   │   ├── layout/         # Layout (Sidebar, TopBar, AppShell)
│   │   ├── CallPanel.tsx   # Panel d'appel téléphonique
│   │   ├── SavedFilters.tsx # Filtres sauvegardés
│   │   └── ...
│   ├── hooks/              # Custom Hooks
│   │   └── useKeyboardShortcuts.ts
│   ├── lib/                # Utilitaires
│   │   ├── prisma.ts       # Client Prisma
│   │   ├── auth.ts         # Fonctions auth
│   │   └── facebook-pixel.ts # Suivi conversions
│   ├── middleware.ts       # Authentification JWT
│   └── styles/
│       └── globals.css     # Styles Tailwind
├── .env                    # Variables d'environnement
├── package.json            # Dépendances
└── README.md               # Ce fichier
```

### Modèle de données (Prisma)

**Entités principales** :
- **User** : Utilisateurs (admin, commercial, telepos)
- **Client** : Fiches clients
- **CallLog** : Historique des appels
- **Planning** : Rendez-vous planifiés
- **Invoice** : Factures
- **Expense** : Dépenses
- **Status** : Statuts personnalisables
- **Team** : Équipes commerciales
- **Campaign** : Campagnes marketing
- **Action** : Actions planifiées

---

## 🎯 Fonctionnalités

### ✨ Nouveautés v1.0

#### 1. Panel d'appel intégré
- Timer automatique
- 6 résultats d'appel prédéfinis
- Notes et commentaires
- Mise à jour automatique du statut client
- Programmation de rappels

#### 2. Raccourcis clavier
- **Ctrl+1 à 5** : Navigation rapide
- **Ctrl+N** : Nouveau client
- **/** : Focus recherche
- **Escape** : Fermer les modals
- **?** : Afficher l'aide

#### 3. Filtres sauvegardés
- Vues rapides épinglées
- Filtres personnalisés
- Sauvegarde dans le navigateur (LocalStorage)
- Organisation par favoris

### 🔐 Sécurité

- **Authentification JWT** avec cookies HttpOnly
- **Hachage bcrypt** des mots de passe (10 rounds)
- **Protection CSRF** via SameSite cookies
- **Middleware** de vérification sur toutes les routes protégées
- **Permissions par rôle** (admin, commercial, telepos)

### 📊 Reporting

- **Dashboard** : KPIs en temps réel
  - Nouveaux clients
  - RDV pris
  - Taux de conversion
  - CA prévisionnel
- **Graphiques** : Évolution temporelle
- **Export Excel** : Extraction de données clients

---

## 🔌 API Endpoints

### Authentification

```
POST   /api/auth/login      # Connexion
POST   /api/auth/logout     # Déconnexion
GET    /api/auth/me         # Utilisateur connecté
```

### Clients

```
GET    /api/clients         # Liste avec pagination & filtres
GET    /api/clients/[id]    # Détails d'un client
POST   /api/clients         # Créer un client
PUT    /api/clients/[id]    # Modifier un client
DELETE /api/clients/[id]    # Supprimer un client
GET    /api/clients/export  # Export Excel
```

**Paramètres de requête** :
- `page` : Numéro de page (défaut: 1)
- `limit` : Résultats par page (défaut: 25)
- `search` : Recherche nom/téléphone/email
- `statusCall` : Filtrer par statut call
- `statusRDV` : Filtrer par statut RDV

### Call Logs

```
POST   /api/call-log        # Enregistrer un appel
GET    /api/call-log?clientId=X # Historique d'un client
```

### Planning

```
GET    /api/planning        # Liste des RDV
POST   /api/planning        # Créer un RDV
PUT    /api/planning/[id]   # Modifier un RDV
DELETE /api/planning/[id]   # Supprimer un RDV
```

### Autres endpoints

```
GET    /api/statuses        # Liste des statuts
GET    /api/users           # Liste des utilisateurs
GET    /api/teams           # Liste des équipes
GET    /api/invoices        # Liste des factures
GET    /api/dashboard       # Données du dashboard
```

---

## ⌨️ Raccourcis clavier

### Navigation

| Raccourci | Action |
|-----------|--------|
| **Ctrl+1** | Aller au Dashboard |
| **Ctrl+2** | Aller aux Clients |
| **Ctrl+3** | Aller au Planning |
| **Ctrl+4** | Aller aux Factures |
| **Ctrl+5** | Aller aux Utilisateurs |

### Actions

| Raccourci | Action |
|-----------|--------|
| **Ctrl+N** | Nouveau client (depuis page Clients) |
| **/** | Focus sur la barre de recherche |
| **Escape** | Fermer le modal/panel actif |
| **?** | Afficher l'aide des raccourcis |

---

## 📈 Suivi des conversions (Facebook Pixel)

### Configuration

1. Créez un Pixel Facebook depuis [Business Manager](https://business.facebook.com/)
2. Copiez votre Pixel ID
3. Ajoutez-le dans `.env` :
   ```env
   NEXT_PUBLIC_FB_PIXEL_ID="123456789"
   ```
4. Redémarrez : `pm2 restart mycrm`

### Événements trackés automatiquement

| Événement Facebook | Déclencheur CRM | Description |
|-------------------|-----------------|-------------|
| **Lead** | Création d'un nouveau client | Nouveau prospect entré dans le système |
| **Schedule** | Statut → "RDV PRIS" | Un rendez-vous commercial est planifié |
| **Purchase** (Signature) | Statut RDV → "SIGNÉ COMPLET/PARTIEL" | Le client a signé le contrat |
| **InitiateCheckout** | Installation programmée | L'installation est planifiée |
| **CompleteRegistration** | Installation terminée | L'installation est achevée |
| **Purchase** (Paiement) | Paiement reçu | Le client a effectué le paiement |

### Optimisation pour panneaux photovoltaïques

Les événements envoient automatiquement :
- **Montant** : Valeur du contrat (si disponible)
- **Devise** : EUR
- **Catégorie** : "CRM"
- **ID Client** : Pour le suivi individuel

**Exemple d'utilisation dans le code** :

```typescript
import { pixelEvents } from "@/lib/facebook-pixel";

// Lors d'une signature
pixelEvents.signature(clientId, 15000); // 15 000€

// Lors d'un paiement
pixelEvents.paiement(clientId, 15000);
```

### Vérifier que le Pixel fonctionne

1. Installez l'extension [Facebook Pixel Helper](https://chrome.google.com/webstore/detail/facebook-pixel-helper/fdgfkebogiimcoedlicjlajpkdmockpc)
2. Naviguez sur votre CRM
3. L'extension doit afficher le Pixel actif avec les événements

---

## 🛠️ Scripts disponibles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Lancer en mode développement (port 3000) |
| `npm run build` | Compiler pour la production |
| `npm start` | Lancer en production (après build) |
| `npm run lint` | Vérifier le code (ESLint) |
| `npm run db:generate` | Générer le client Prisma |
| `npm run db:push` | Appliquer le schéma à la DB |
| `npm run db:seed` | Créer les données de test |
| `npm run db:studio` | Ouvrir Prisma Studio (UI pour la DB) |

---

## 🐛 Dépannage

### L'application ne démarre pas

```bash
# Vérifier les logs PM2
pm2 logs mycrm

# Redémarrer
pm2 restart mycrm

# Rebuild complet
cd /var/www/mycrm
npm run build
pm2 restart mycrm
```

### Erreur de base de données

```bash
# Régénérer le client Prisma
npm run db:generate

# Réappliquer le schéma
npm run db:push

# Recréer les données de test
npm run db:seed
```

### Erreur JWT / Authentification

- Vérifiez que `JWT_SECRET` est défini dans `.env`
- Videz les cookies du navigateur
- Reconnectez-vous

### Facebook Pixel ne fonctionne pas

1. Vérifiez que `NEXT_PUBLIC_FB_PIXEL_ID` est défini dans `.env`
2. Variables `NEXT_PUBLIC_*` nécessitent un rebuild :
   ```bash
   npm run build
   pm2 restart mycrm
   ```
3. Vérifiez avec Facebook Pixel Helper (extension Chrome)

### Port 3000 déjà utilisé

```bash
# Trouver le processus
lsof -i :3000

# Ou changer le port
PORT=3001 npm start
```

---

## 📞 Support

Pour toute question ou problème :
- **Email** : support@bhcompany.com
- **Documentation Prisma** : https://www.prisma.io/docs
- **Documentation Next.js** : https://nextjs.org/docs

---

## 📝 Notes de version

### v1.0.0 - 2026-02-11

**Fonctionnalités principales** :
- ✅ Système d'authentification JWT sécurisé
- ✅ Gestion complète des clients (CRUD)
- ✅ Planning des RDV avec notifications
- ✅ Panel d'appel téléphonique intégré
- ✅ Raccourcis clavier pour productivité
- ✅ Filtres sauvegardés personnalisables
- ✅ Dashboard avec KPIs temps réel
- ✅ Suivi des conversions Facebook Pixel
- ✅ Export Excel des données
- ✅ Gestion des factures et dépenses
- ✅ Système de permissions par rôle
- ✅ Thème moderne avec Tailwind CSS v4

---

## 📄 Licence

© 2026 Mon CRM - Tous droits réservés
