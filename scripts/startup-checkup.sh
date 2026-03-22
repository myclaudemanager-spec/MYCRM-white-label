#!/bin/bash

###############################################################################
# 🚀 STARTUP CHECKUP - Lancement automatique au début de chaque session
#
# Ce script est exécuté AUTOMATIQUEMENT par Claude Sonnet au début
# de chaque session pour avoir une vue d'ensemble instantanée du système.
#
# Utilise les agents Haiku pour économie maximale (~$0.03 vs $0.25)
###############################################################################

echo "🚀 STARTUP CHECKUP - CRM BH Company"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

SCRIPTS_DIR="/var/www/mycrm/scripts"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "📅 Session démarrée : $TIMESTAMP"
echo ""

# Lancer les 5 agents Haiku en parallèle (ultra rapide)
echo "🤖 Agents Haiku en cours d'exécution..."
echo ""

# 1. Monitoring système complet
echo "1️⃣  Monitoring système..."
node "$SCRIPTS_DIR/assistant-haiku-agent.js" monitor > /tmp/checkup-monitor.json 2>&1 &
PID_MONITOR=$!

# 2. Git status
echo "2️⃣  Git status..."
node "$SCRIPTS_DIR/assistant-haiku-agent.js" git-status > /tmp/checkup-git-status.json 2>&1 &
PID_GIT_STATUS=$!

# 3. Git log
echo "3️⃣  Git log (50 commits)..."
node "$SCRIPTS_DIR/assistant-haiku-agent.js" git-log 50 > /tmp/checkup-git-log.json 2>&1 &
PID_GIT_LOG=$!

# 4. Analyse DB
echo "4️⃣  Analyse database..."
node "$SCRIPTS_DIR/assistant-haiku-agent.js" analyze-db > /tmp/checkup-db.json 2>&1 &
PID_DB=$!

# 5. Check dependencies
echo "5️⃣  Check dependencies npm..."
node "$SCRIPTS_DIR/assistant-haiku-agent.js" check-deps > /tmp/checkup-deps.json 2>&1 &
PID_DEPS=$!

# Attendre que tous les agents finissent
wait $PID_MONITOR $PID_GIT_STATUS $PID_GIT_LOG $PID_DB $PID_DEPS

echo ""
echo "✅ Tous les agents ont terminé !"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Extraire les scores/statuts principaux
echo "📊 RÉSUMÉ RAPIDE :"
echo ""

# Score monitoring
SCORE=$(grep -o '"score":"[^"]*"' /tmp/checkup-monitor.json 2>/dev/null | head -1 | cut -d'"' -f4)
if [ -n "$SCORE" ]; then
    echo "  🏥 Santé système : $SCORE"
fi

# Git status
GIT_CLEAN=$(grep -o '"clean":[^,]*' /tmp/checkup-git-status.json 2>/dev/null | head -1 | cut -d':' -f2)
if [ "$GIT_CLEAN" = "true" ]; then
    echo "  🔀 Git : Working tree clean ✅"
else
    UNCOMMITTED=$(grep -o '"totalFiles":[0-9]*' /tmp/checkup-git-status.json 2>/dev/null | head -1 | cut -d':' -f2)
    echo "  🔀 Git : $UNCOMMITTED fichiers modifiés ⚠️"
fi

# Git log
FEATURES=$(grep -o '"features":[0-9]*' /tmp/checkup-git-log.json 2>/dev/null | head -1 | cut -d':' -f2)
FIXES=$(grep -o '"fixes":[0-9]*' /tmp/checkup-git-log.json 2>/dev/null | head -1 | cut -d':' -f2)
if [ -n "$FEATURES" ]; then
    echo "  📜 Git (50 commits) : $FEATURES features, $FIXES fixes"
fi

# Database
DB_SIZE=$(grep -o '"size":"[^"]*"' /tmp/checkup-db.json 2>/dev/null | head -1 | cut -d'"' -f4)
DB_RECORDS=$(grep -o '"totalRecords":[0-9]*' /tmp/checkup-db.json 2>/dev/null | head -1 | cut -d':' -f2)
if [ -n "$DB_SIZE" ]; then
    echo "  💾 Database : $DB_SIZE, $DB_RECORDS records"
fi

# Dependencies
VULNS=$(grep -o '"total":[0-9]*' /tmp/checkup-deps.json 2>/dev/null | head -1 | cut -d':' -f2)
OUTDATED=$(grep -o '"count":[0-9]*' /tmp/checkup-deps.json 2>/dev/null | head -1 | cut -d':' -f2)
if [ -n "$VULNS" ]; then
    if [ "$VULNS" = "0" ]; then
        echo "  📦 Dependencies : 0 vulns ✅, $OUTDATED outdated"
    else
        echo "  📦 Dependencies : $VULNS vulns ⚠️, $OUTDATED outdated"
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 Résultats détaillés disponibles dans /tmp/checkup-*.json"
echo "💰 Coût estimé : ~\$0.03 (5 agents Haiku)"
echo ""
echo "✅ Système prêt - Claude Sonnet peut maintenant analyser et décider"
echo ""

# Sauvegarder l'historique
mkdir -p /var/www/mycrm/logs/startup-checkups
CHECKUP_LOG="/var/www/mycrm/logs/startup-checkups/checkup-$(date '+%Y%m%d-%H%M%S').log"
cat /tmp/checkup-*.json > "$CHECKUP_LOG" 2>/dev/null
echo "📁 Checkup sauvegardé : $CHECKUP_LOG"
echo ""
