import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { calculateLeadScore } from "@/lib/lead-scoring";
import { trackQualifiedLead, trackDisqualifiedLead } from "@/lib/facebook-conversions-api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Vérifier authentification
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const resolvedParams = await params;
    const clientId = parseInt(resolvedParams.id);
    const startTime = Date.now();

    // Récupérer données de qualification
    const body = await request.json();
    const { proprietaire, typeLogement, codePostal } = body;

    // Validation
    if (!proprietaire || !typeLogement || !codePostal) {
      return NextResponse.json(
        { error: "Données de qualification incomplètes" },
        { status: 400 }
      );
    }

    // Récupérer le client
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      return NextResponse.json(
        { error: "Client non trouvé" },
        { status: 404 }
      );
    }

    // Vérifier critères de disqualification
    const isLocataire = proprietaire.toLowerCase() === "locataire" || proprietaire.toLowerCase() === "non";
    const isCopropriete = typeLogement.toLowerCase().includes("appartement") || typeLogement.toLowerCase().includes("copropriété");

    // Codes postaux PACA (départements 13, 30, 83, 84)
    const departement = codePostal.substring(0, 2);
    const isHorsZone = !["13", "30", "83", "84"].includes(departement);

    // DISQUALIFICATION
    if (isLocataire) {
      const qualificationTime = Date.now() - startTime;

      // Mettre à jour client
      const updatedClient = await prisma.client.update({
        where: { id: clientId },
        data: {
          statusCall: "NON QUALIFIÉ",
          archived: true,
          archivedAt: new Date(),
          archiveReason: "LOCATAIRE",
          disqualifiedAt: new Date(),
          disqualificationReason: "LOCATAIRE",
          qualificationTime,
          pixelDisqualifiedSent: true,
          isOwner: "Non",
        },
      });

      // Envoyer événement Facebook Pixel
      await trackDisqualifiedLead(
        {
          email: client.email || undefined,
          mobile: client.mobile || undefined,
          firstName: client.firstName || undefined,
          lastName: client.lastName || undefined,
          city: client.city || undefined,
          zipCode: client.zipCode || undefined,
          id: client.id,
          fbLeadId: client.fbLeadId,
          fbCampaignId: client.fbCampaignId,
          fbAdSetId: client.fbAdSetId,
          fbAdId: client.fbAdId,
          fbFormId: client.fbFormId,
        },
        "LOCATAIRE"
      );

      return NextResponse.json({
        status: "disqualified",
        reason: "LOCATAIRE",
        message: "Lead disqualifié : Locataire",
        client: updatedClient,
        qualificationTime,
      });
    }

    if (isCopropriete) {
      const qualificationTime = Date.now() - startTime;

      // Mettre à jour client
      const updatedClient = await prisma.client.update({
        where: { id: clientId },
        data: {
          statusCall: "NON QUALIFIÉ",
          archived: true,
          archivedAt: new Date(),
          archiveReason: "COPROPRIETE",
          disqualifiedAt: new Date(),
          disqualificationReason: "COPROPRIETE",
          qualificationTime,
          pixelDisqualifiedSent: true,
          propertyType: typeLogement,
        },
      });

      // Envoyer événement Facebook Pixel
      await trackDisqualifiedLead(
        {
          email: client.email || undefined,
          mobile: client.mobile || undefined,
          firstName: client.firstName || undefined,
          lastName: client.lastName || undefined,
          city: client.city || undefined,
          zipCode: client.zipCode || undefined,
          id: client.id,
          fbLeadId: client.fbLeadId,
          fbCampaignId: client.fbCampaignId,
          fbAdSetId: client.fbAdSetId,
          fbAdId: client.fbAdId,
          fbFormId: client.fbFormId,
        },
        "COPROPRIETE"
      );

      return NextResponse.json({
        status: "disqualified",
        reason: "COPROPRIETE",
        message: "Lead disqualifié : Copropriété/Appartement",
        client: updatedClient,
        qualificationTime,
      });
    }

    if (isHorsZone) {
      const qualificationTime = Date.now() - startTime;

      // Mettre à jour client
      const updatedClient = await prisma.client.update({
        where: { id: clientId },
        data: {
          statusCall: "NON QUALIFIÉ",
          archived: true,
          archivedAt: new Date(),
          archiveReason: "HORS_ZONE",
          disqualifiedAt: new Date(),
          disqualificationReason: "HORS_ZONE",
          qualificationTime,
          pixelDisqualifiedSent: true,
          zipCode: codePostal,
        },
      });

      // Envoyer événement Facebook Pixel
      await trackDisqualifiedLead(
        {
          email: client.email || undefined,
          mobile: client.mobile || undefined,
          firstName: client.firstName || undefined,
          lastName: client.lastName || undefined,
          city: client.city || undefined,
          zipCode: codePostal,
          id: client.id,
          fbLeadId: client.fbLeadId,
          fbCampaignId: client.fbCampaignId,
          fbAdSetId: client.fbAdSetId,
          fbAdId: client.fbAdId,
          fbFormId: client.fbFormId,
        },
        "HORS_ZONE"
      );

      return NextResponse.json({
        status: "disqualified",
        reason: "HORS_ZONE",
        message: `Lead disqualifié : Hors zone PACA (département ${departement})`,
        client: updatedClient,
        qualificationTime,
      });
    }

    // QUALIFICATION RÉUSSIE
    const qualificationTime = Date.now() - startTime;

    // Mettre à jour les champs et recalculer le score
    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: {
        statusCall: "À QUALIFIER",
        isOwner: "Oui",
        propertyType: typeLogement,
        zipCode: codePostal,
        qualifiedAt: new Date(),
        qualificationTime,
      },
    });

    // Recalculer le score automatiquement
    const scoreResult = calculateLeadScore(updatedClient);

    // Mettre à jour le score
    const finalClient = await prisma.client.update({
      where: { id: clientId },
      data: {
        leadScore: scoreResult.total,
        leadPriority: scoreResult.priority,
        leadScoreDetails: JSON.stringify(scoreResult.details),
        leadScoreUpdatedAt: new Date(),
        pixelQualifiedLeadSent: true,
      },
    });

    // Envoyer événement Facebook Pixel QualifiedLead (si pas déjà envoyé)
    if (!client.pixelQualifiedLeadSent) {
      await trackQualifiedLead(
        {
          email: finalClient.email || undefined,
          mobile: finalClient.mobile || undefined,
          firstName: finalClient.firstName || undefined,
          lastName: finalClient.lastName || undefined,
          city: finalClient.city || undefined,
          zipCode: finalClient.zipCode || undefined,
          id: finalClient.id,
          fbLeadId: finalClient.fbLeadId,
          fbCampaignId: finalClient.fbCampaignId,
          fbAdSetId: finalClient.fbAdSetId,
          fbAdId: finalClient.fbAdId,
          fbFormId: finalClient.fbFormId,
        },
        scoreResult.total,
        "QUALIFICATION_EXPRESS"
      );
    }

    return NextResponse.json({
      status: "qualified",
      message: "Lead qualifié avec succès",
      client: finalClient,
      leadScore: scoreResult.total,
      leadPriority: scoreResult.priority,
      qualificationTime,
    });
  } catch (error) {
    console.error("❌ Erreur quick-qualify:", error);
    return NextResponse.json(
      { error: "Erreur lors de la qualification" },
      { status: 500 }
    );
  }
}
