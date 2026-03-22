#!/bin/bash

# ==========================================
# SCRIPT DE VÉRIFICATION DE CONFIGURATION
# ==========================================
# Vérifie que toutes les configurations critiques sont en place
# avant un rebuild pour éviter les régressions.
#
# Usage: ./scripts/verify-config.sh

echo "🔍 VÉRIFICATION DE LA CONFIGURATION DU CRM"
echo "==========================================="
echo ""

ERRORS=0

# 1. Vérifier @config dans globals.css
echo "1️⃣  Vérification Tailwind CSS..."
if grep -q '@config "../../tailwind.config.ts"' src/styles/globals.css; then
    echo "   ✅ @config présent dans globals.css"
else
    echo "   ❌ @config MANQUANT dans globals.css"
    echo "      Ajouter: @config \"../../tailwind.config.ts\";"
    ERRORS=$((ERRORS + 1))
fi

# 2. Vérifier tailwind.config.ts existe
if [ -f "tailwind.config.ts" ]; then
    echo "   ✅ tailwind.config.ts existe"
else
    echo "   ❌ tailwind.config.ts MANQUANT"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# 3. Vérifier .env - Pixel ID correct
echo "2️⃣  Vérification Facebook Pixel ID..."
if grep -q 'NEXT_PUBLIC_FB_PIXEL_ID="873087782355274"' .env; then
    echo "   ✅ Pixel ID correct (873087782355274)"
elif grep -q 'NEXT_PUBLIC_FB_PIXEL_ID="1557240932171719"' .env; then
    echo "   ❌ Pixel ID INCORRECT (App ID utilisé)"
    echo "      Changer pour: 873087782355274"
    ERRORS=$((ERRORS + 1))
else
    echo "   ⚠️  Pixel ID non trouvé dans .env"
fi

echo ""

# 4. Vérifier Google Sheet utilise enrichedData
echo "3️⃣  Vérification Google Sheet (données en clair)..."
if grep -q "enrichedData.mobile" src/lib/lead-ingestion-service.ts; then
    echo "   ✅ enrichedData utilisé pour Google Sheet"
else
    echo "   ❌ client.mobile utilisé (DONNÉES CHIFFRÉES)"
    echo "      Changer pour: enrichedData.mobile"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# 5. Vérifier API facebook-leads accepte proprietaire
echo "4️⃣  Vérification filtrage locataires..."
if grep -q "proprietaire" src/app/api/facebook-leads/route.ts; then
    echo "   ✅ Champ proprietaire présent dans API"
else
    echo "   ⚠️  Champ proprietaire non trouvé"
fi

echo ""

# 6. Vérifier structure package.json
echo "5️⃣  Vérification dépendances..."
if grep -q '"tailwindcss": "^4' package.json; then
    echo "   ✅ Tailwind CSS v4 installé"
else
    echo "   ⚠️  Tailwind CSS version incorrecte"
fi

if grep -q '"@tailwindcss/postcss"' package.json; then
    echo "   ✅ @tailwindcss/postcss installé"
else
    echo "   ❌ @tailwindcss/postcss MANQUANT"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "==========================================="

# Résultat final
if [ $ERRORS -eq 0 ]; then
    echo "✅ TOUTES LES VÉRIFICATIONS PASSÉES"
    echo ""
    echo "Le système est prêt pour un rebuild."
    exit 0
else
    echo "❌ $ERRORS ERREUR(S) DÉTECTÉE(S)"
    echo ""
    echo "⚠️  CORRIGEZ LES ERREURS AVANT DE CONTINUER"
    echo "📖 Consulter TECHNICAL_GUIDE.md pour plus d'infos"
    exit 1
fi
