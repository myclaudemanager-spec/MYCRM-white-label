#!/bin/bash

# Script pour visualiser rapidement l'état de santé du CRM

LATEST_REPORT="/var/www/mycrm/reports/latest_health_report.txt"
REPORT_DIR="/var/www/mycrm/reports"

# Fonction d'aide
show_help() {
    echo "Usage: $0 [option]"
    echo ""
    echo "Options:"
    echo "  (aucune)    Afficher le dernier rapport"
    echo "  --list      Lister tous les rapports disponibles"
    echo "  --run       Lancer une nouvelle analyse immédiatement"
    echo "  --watch     Afficher le dernier rapport et surveiller les changements"
    echo "  --help      Afficher cette aide"
    echo ""
}

# Vérifier l'argument
case "${1:-}" in
    --list)
        echo "📊 RAPPORTS D'ANALYSE DISPONIBLES"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        ls -lht "$REPORT_DIR"/health_report_*.txt 2>/dev/null | head -10 | awk '{print $6, $7, $8, $9}'
        echo ""
        echo "Pour voir un rapport spécifique:"
        echo "  cat $REPORT_DIR/health_report_YYYYMMDD_HHMMSS.txt"
        ;;
    --run)
        echo "🔄 Lancement d'une nouvelle analyse..."
        /var/www/mycrm/scripts/analyze-optimize.sh
        ;;
    --watch)
        if [ -f "$LATEST_REPORT" ]; then
            watch -n 5 cat "$LATEST_REPORT"
        else
            echo "❌ Aucun rapport disponible"
            echo "Lancez d'abord: $0 --run"
        fi
        ;;
    --help)
        show_help
        ;;
    "")
        if [ -f "$LATEST_REPORT" ]; then
            cat "$LATEST_REPORT"
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "💡 Commandes utiles:"
            echo "   $0 --list    → Voir tous les rapports"
            echo "   $0 --run     → Nouvelle analyse maintenant"
            echo "   $0 --watch   → Surveiller en temps réel"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        else
            echo "❌ Aucun rapport disponible"
            echo ""
            echo "Pour générer le premier rapport:"
            echo "  $0 --run"
        fi
        ;;
    *)
        echo "❌ Option inconnue: $1"
        echo ""
        show_help
        exit 1
        ;;
esac
