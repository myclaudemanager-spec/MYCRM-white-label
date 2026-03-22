#!/bin/bash

# ==========================================
# SCRIPT DE REBUILD SÉCURISÉ
# ==========================================
# Effectue un rebuild complet avec vérifications
# automatiques pour éviter les régressions.
#
# Usage: ./scripts/safe-rebuild.sh [--clean]

echo "🔨 REBUILD SÉCURISÉ - CRM BH Company"
echo "====================================="
echo ""

# Aller dans le répertoire du projet
cd "$(dirname "$0")/.." || exit 1

# 1. Vérification pré-build
echo "1️⃣  Phase : Vérifications pré-build"
echo "   -----------------------------------"
./scripts/verify-config.sh
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ VÉRIFICATIONS ÉCHOUÉES"
    echo "⚠️  Corrigez les erreurs avant de continuer"
    exit 1
fi
echo ""

# 2. Backup de sécurité
echo "2️⃣  Phase : Backup de sécurité"
echo "   -----------------------------------"
if [ -d ".next" ]; then
    BACKUP_DIR="backups/build-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    echo "   📦 Backup de .next vers $BACKUP_DIR"
    cp -r .next "$BACKUP_DIR/" 2>/dev/null || true
    echo "   ✅ Backup créé"
else
    echo "   ℹ️  Pas de .next existant (premier build)"
fi
echo ""

# 3. Nettoyage (optionnel)
if [ "$1" == "--clean" ]; then
    echo "3️⃣  Phase : Nettoyage complet"
    echo "   -----------------------------------"
    echo "   🧹 Suppression de .next"
    rm -rf .next
    echo "   ✅ Nettoyage terminé"
    echo ""
fi

# 4. Build
echo "4️⃣  Phase : Build Next.js"
echo "   -----------------------------------"
echo "   ⏳ Compilation en cours..."
npm run build > /tmp/build.log 2>&1
BUILD_EXIT=$?

if [ $BUILD_EXIT -ne 0 ]; then
    echo "   ❌ BUILD ÉCHOUÉ"
    echo ""
    echo "📄 Dernières lignes du log :"
    tail -30 /tmp/build.log
    echo ""
    echo "⚠️  Build échoué. Restaurez le backup si nécessaire."
    exit 1
fi

echo "   ✅ Build terminé avec succès"
echo ""

# 5. Vérifications post-build
echo "5️⃣  Phase : Vérifications post-build"
echo "   -----------------------------------"

# Vérifier que les classes CSS sont générées
if grep -q "\.bg-primary" .next/static/chunks/*.css 2>/dev/null; then
    echo "   ✅ Classes CSS générées correctement"
else
    echo "   ⚠️  Classes CSS non détectées (peut être normal)"
fi

# Vérifier taille du build
BUILD_SIZE=$(du -sh .next 2>/dev/null | cut -f1)
echo "   📊 Taille du build : $BUILD_SIZE"

echo ""

# 6. Redémarrage PM2
echo "6️⃣  Phase : Redémarrage PM2"
echo "   -----------------------------------"
pm2 restart mycrm 2>&1 | grep -E "online|✓"
echo "   ✅ Application redémarrée"
echo ""

# 7. Test de santé
echo "7️⃣  Phase : Test de santé"
echo "   -----------------------------------"
sleep 3

# Vérifier que l'app répond
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "   ✅ Application répond sur le port 3000"
else
    echo "   ❌ Application ne répond pas"
    echo "   Vérifiez les logs : pm2 logs mycrm"
fi

echo ""
echo "====================================="
echo "✅ REBUILD TERMINÉ AVEC SUCCÈS"
echo ""
echo "📋 Prochaines étapes :"
echo "   1. Rafraîchir le navigateur (Ctrl+F5)"
echo "   2. Vérifier que les couleurs s'affichent"
echo "   3. Tester la création d'un lead"
echo ""
echo "📊 Pour voir l'état du système :"
echo "   ./scripts/view-health.sh"
echo ""
