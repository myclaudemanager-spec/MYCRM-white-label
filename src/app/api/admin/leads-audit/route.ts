/**
 * API Audit Facebook Lead Ads
 *
 * Endpoint: GET /api/admin/leads-audit
 * Admin only
 *
 * Retourne les statistiques complètes sur :
 * - Sources des leads (Facebook vs manuels)
 * - Statut propriétaire/locataire
 * - État webhook Facebook
 * - Recommandations
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    // Vérifier auth + admin
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Récupérer les stats
    const totalLeads = await prisma.client.count();

    const facebookLeads = await prisma.client.count({
      where: { fbLeadId: { not: null } }
    });

    const manualLeads = totalLeads - facebookLeads;

    // Statut propriétaire
    const owners = await prisma.client.count({
      where: { isOwner: "Oui" }
    });

    const rentersDetected = await prisma.client.count({
      where: {
        OR: [
          { observation: { contains: "LOCATAIRE" } },
          { observation: { contains: "locataire" } }
        ]
      }
    });

    const unknownStatus = await prisma.client.count({
      where: {
        OR: [
          { isOwner: null },
          { isOwner: "" }
        ]
      }
    });

    // Campagnes Facebook
    const campaigns = await prisma.client.groupBy({
      by: ["campaign"],
      where: { campaign: { not: null } },
      _count: true,
      orderBy: {
        _count: {
          campaign: 'desc'
        }
      }
    });

    // Vérifier token Facebook
    const tokenStatus = checkFacebookToken();

    // Calculer pourcentages
    const stats = {
      audit_date: new Date().toISOString(),

      // Résumé global
      summary: {
        total_leads: totalLeads,
        facebook_leads: facebookLeads,
        facebook_leads_pct: totalLeads > 0 ? ((facebookLeads / totalLeads) * 100).toFixed(1) : 0,
        manual_leads: manualLeads,
        manual_leads_pct: totalLeads > 0 ? ((manualLeads / totalLeads) * 100).toFixed(1) : 100,
      },

      // Statut propriétaire
      ownership_status: {
        owners: owners,
        owners_pct: totalLeads > 0 ? ((owners / totalLeads) * 100).toFixed(1) : 0,
        renters_detected: rentersDetected,
        renters_pct: totalLeads > 0 ? ((rentersDetected / totalLeads) * 100).toFixed(1) : 0,
        unknown: unknownStatus,
        unknown_pct: totalLeads > 0 ? ((unknownStatus / totalLeads) * 100).toFixed(1) : 0,
      },

      // Campagnes
      campaigns: campaigns.map(c => ({
        name: c.campaign || "NONE",
        count: c._count || 0
      })),

      // État Facebook
      facebook_status: {
        token_valid: tokenStatus.valid,
        token_status: tokenStatus.status,
        webhook_url: "/api/facebook/leads-webhook",
        webhook_status: tokenStatus.valid ? "READY" : "BLOCKED",
        formulas_verified: false,
        last_check: new Date().toISOString()
      },

      // Alertes
      alerts: generateAlerts({
        totalLeads,
        facebookLeads,
        owners,
        unknownStatus,
        tokenValid: tokenStatus.valid
      }),

      // Recommandations
      recommendations: generateRecommendations({
        facebookLeads,
        owners,
        unknownStatus,
        tokenValid: tokenStatus.valid
      })
    };

    return NextResponse.json(stats, { status: 200 });

  } catch (error) {
    console.error("❌ Erreur audit leads:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Vérifier l'état du token Facebook
 */
function checkFacebookToken(): { valid: boolean; status: string } {
  const token = process.env.FB_ACCESS_TOKEN || "";

  if (!token) {
    return { valid: false, status: "NOT_CONFIGURED" };
  }

  if (token.includes("EAAWITWiXf8cBQv0a3W8I3oIcDIc3rOJqsQPbGM1mma3zcCg46pZAtOwTYziWqWgv8a1zYnwHFx6El6FhWPsuEL36LnfzUrKBmF5jvV0K6V6W6GE6G83aHE7fgZCckbzj3pdkCIXZANNskbMIE3aGHEoZAnrZAuPq8ewYAt4I1kBMr0fiHoy7ZC5v3SHnnyy8ZChHw5Jn0LJfF9P")) {
    return { valid: false, status: "EXPIRED" };
  }

  // Token commence par EAA = valide en théorie (vérification réelle en API call)
  if (token.startsWith("EAA")) {
    return { valid: true, status: "CONFIGURED" };
  }

  return { valid: false, status: "INVALID_FORMAT" };
}

/**
 * Générer les alertes
 */
function generateAlerts(data: {
  totalLeads: number;
  facebookLeads: number;
  owners: number;
  unknownStatus: number;
  tokenValid: boolean;
}): string[] {
  const alerts: string[] = [];

  if (!data.tokenValid) {
    alerts.push("🔴 CRITIQUE : Token Facebook expiré - Webhook ne fonctionne pas");
  }

  if (data.facebookLeads === 0) {
    alerts.push("⚠️ Aucun lead Facebook reçu en base (possiblement webhook non activé)");
  }

  if (data.unknownStatus > data.totalLeads * 0.5) {
    alerts.push(`⚠️ ${data.unknownStatus} leads (${((data.unknownStatus/data.totalLeads)*100).toFixed(0)}%) sans statut propriétaire renseigné`);
  }

  if (data.owners === 0 && data.totalLeads > 0) {
    alerts.push("⚠️ Aucun propriétaire confirmé en base de données");
  }

  if (data.totalLeads > 1000) {
    alerts.push("ℹ️ Base de données importante (> 1000 leads) - Vérifier performances");
  }

  return alerts;
}

/**
 * Générer les recommandations
 */
function generateRecommendations(data: {
  facebookLeads: number;
  owners: number;
  unknownStatus: number;
  tokenValid: boolean;
}): string[] {
  const recommendations: string[] = [];

  if (!data.tokenValid) {
    recommendations.push("1️⃣ URGENT: Renouveler le token Facebook (https://developers.facebook.com/tools/explorer/)");
    recommendations.push("2️⃣ Vérifier la configuration du webhook Facebook");
  }

  if (data.facebookLeads === 0) {
    recommendations.push("3️⃣ Vérifier que les formulaires Lead Ads sont connectés au webhook");
  }

  if (data.unknownStatus > 0) {
    recommendations.push("4️⃣ Ajouter une question 'Êtes-vous propriétaire ?' aux formulaires Lead Ads");
  }

  if (data.owners > 0 && data.unknownStatus > 0) {
    recommendations.push("5️⃣ Mettre à jour manuellement les statuts des leads existants");
  }

  recommendations.push("6️⃣ Implémenter le rejet automatique des locataires via webhook");

  return recommendations;
}
