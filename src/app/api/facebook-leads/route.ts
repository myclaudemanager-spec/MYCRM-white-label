/**
 * 🌐 API LANDING PAGE EXTERNE : devis-solaire-paca.fr
 *
 * Reçoit les leads depuis la landing page externe (CORS activé).
 * REFACTORÉ pour utiliser LeadIngestionService.
 *
 * Spécificités :
 * - Validation stricte PACA (13, 30, 83, 84)
 * - CORS headers pour domaine externe
 * - Mise à jour lead si déjà existant
 */

import { NextRequest, NextResponse } from "next/server";
import { leadIngestionService, LeadSource } from "@/lib/lead-ingestion-service";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * OPTIONS - CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

/**
 * POST - Réception lead depuis landing page externe
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nom, email, telephone, codePostal, departement, source, proprietaire } = body;

    console.log(`[LandingPagePACA] ${new Date().toISOString()} - Nouveau lead reçu (proprietaire: ${proprietaire})`);

    // 1. Validation champs obligatoires
    if (!nom || !email || !telephone || !codePostal) {
      return NextResponse.json(
        { error: "Champs obligatoires manquants" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 2. Validation nom (lettres uniquement)
    const nomRegex = /^[a-zA-ZÀ-ÿ\s\-']+$/;
    if (!nomRegex.test(nom)) {
      return NextResponse.json(
        { error: "Nom invalide. Lettres uniquement, pas de chiffres." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 3. Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Email invalide" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 4. Validation téléphone français (10 chiffres, commence par 0)
    const cleanTel = telephone.replace(/\s/g, '');
    const telRegex = /^0[1-9]\d{8}$/;
    if (!telRegex.test(cleanTel)) {
      return NextResponse.json(
        { error: "Numéro de téléphone invalide (format: 06 12 34 56 78)" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 5. Validation code postal PACA uniquement (13, 30, 83, 84)
    const cpRegex = /^(13|30|83|84)\d{3}$/;
    if (!cpRegex.test(codePostal)) {
      return NextResponse.json(
        { error: "Code postal hors zone PACA (13, 30, 83, 84 uniquement)" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 6. ⚠️ VALIDATION STRICTE : Statut propriétaire OBLIGATOIRE
    if (!proprietaire || proprietaire.trim() === '') {
      console.log('[LandingPagePACA] ❌ Statut propriétaire manquant - Lead rejeté');
      return NextResponse.json(
        {
          error: 'Statut propriétaire obligatoire',
          message: 'Veuillez indiquer si vous êtes propriétaire ou locataire'
        },
        { status: 422, headers: CORS_HEADERS }
      );
    }

    // 7. ⚠️ VALIDATION STRICTE : Locataires rejetés
    const proprietaireLower = proprietaire.toLowerCase().trim();
    const locataireKeywords = ['non', 'no', 'locataire', 'tenant', 'renter'];
    const isLocataire = locataireKeywords.some(keyword => proprietaireLower === keyword || proprietaireLower.includes(keyword));

    if (isLocataire) {
      console.log(`[LandingPagePACA] ❌ Lead locataire - Lead rejeté (valeur: "${proprietaire}")`);
      return NextResponse.json(
        {
          error: 'Lead locataire non accepté',
          message: 'Notre offre est réservée aux propriétaires uniquement'
        },
        { status: 422, headers: CORS_HEADERS }
      );
    }

    console.log(`[LandingPagePACA] ✅ Lead propriétaire validé (valeur: "${proprietaire}")`);

    // 8. Parser nom complet
    const nameParts = nom.trim().split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || firstName;

    // 7. Vérifier si lead existe déjà (avant d'appeler service)
    const existingClient = await prisma.client.findFirst({
      where: {
        OR: [
          { phone1: cleanTel },
          { mobile: cleanTel },
          { AND: [{ firstName }, { lastName }] },
        ],
      },
    });

    if (existingClient) {
      // Lead existant : mettre à jour
      console.log(`[LandingPagePACA] 🔄 Lead existant détecté (ID: ${existingClient.id}) - Mise à jour`);

      const updatedClient = await prisma.client.update({
        where: { id: existingClient.id },
        data: {
          campaign: source || "devis-solaire-paca.fr",
          statusCall: "NOUVEAU LEAD",
        },
      });

      // Log action
      await prisma.action.create({
        data: {
          clientId: updatedClient.id,
          type: "Lead renouvelé",
          detail: `Lead renouvelé depuis ${source || "landing page"} (${departement})`,
        },
      });

      return NextResponse.json(
        {
          success: true,
          message: "Lead existant mis à jour",
          clientId: updatedClient.id,
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // 8. 🎯 DÉLÉGUER au service central d'ingestion
    const result = await leadIngestionService.ingest(LeadSource.LANDING_PAGE, {
      firstName,
      lastName,
      email,
      mobile: cleanTel,
      phone: cleanTel,
      zipCode: codePostal,
      isOwner: proprietaire, // ✅ Ajout filtrage propriétaire/locataire
      // city sera enrichi automatiquement par le service
      sourceMetadata: {
        source: source || "devis-solaire-paca.fr",
        departement,
        originalNom: nom,
        proprietaire: proprietaire || "non renseigné",
        landingPageReceivedAt: new Date().toISOString(),
      }
    });

    if (result.success) {
      console.log(`[LandingPagePACA] ✅ Lead créé avec succès - Client ID: ${result.client.id}`);

      return NextResponse.json(
        {
          success: true,
          message: "Lead créé avec succès",
          clientId: result.client.id,
        },
        { status: 201, headers: CORS_HEADERS }
      );
    } else {
      console.log(`[LandingPagePACA] ⚠️  Lead rejeté - Status: ${result.status} - ${result.error}`);

      return NextResponse.json(
        {
          error: "Lead rejeté",
          reason: result.error,
          status: result.status,
        },
        { status: 422, headers: CORS_HEADERS }
      );
    }

  } catch (error: unknown) {
    console.error("[LandingPagePACA] ❌ Erreur:", error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';

    return NextResponse.json(
      {
        error: "Erreur serveur",
        details: errorMessage,
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

/**
 * GET - Récupérer les leads depuis cette landing page (debug)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const since = searchParams.get("since");

    const whereClause: Prisma.ClientWhereInput = {
      OR: [
        { campaign: { contains: "devis-solaire-paca" } },
        { sourceType: LeadSource.LANDING_PAGE },
      ]
    };

    if (since) {
      const sinceDate = new Date(since);
      whereClause.createdAt = { gte: sinceDate };
    }

    const leads = await prisma.client.findMany({
      where: whereClause,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone1: true,
        mobile: true,
        city: true,
        campaign: true,
        sourceType: true,
        statusCall: true,
        statusRDV: true,
        createdAt: true,
        ingestedAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(
      {
        success: true,
        count: leads.length,
        leads,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("[LandingPagePACA] ❌ Erreur GET:", error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';

    return NextResponse.json(
      {
        error: "Erreur serveur",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
