import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { calculateLeadScore } from "@/lib/lead-scoring";

/**
 * GET /api/clients/[id]/score
 * Calcule et retourne le score d'un lead
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id } = await params;
    const clientId = parseInt(id);

    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
    }

    // Calculer le score
    const score = calculateLeadScore(client);

    return NextResponse.json({
      success: true,
      score,
    });
  } catch (error: any) {
    console.error("Erreur calcul score:", error);
    return NextResponse.json(
      { error: "Erreur serveur", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clients/[id]/score
 * Calcule ET sauvegarde le score d'un lead dans la DB
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id } = await params;
    const clientId = parseInt(id);

    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
    }

    // Calculer le score
    const score = calculateLeadScore(client);

    // Sauvegarder dans la DB
    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: {
        leadScore: score.total,
        leadPriority: score.priority,
        leadScoreDetails: JSON.stringify(score.details),
        leadScoreUpdatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      score,
      client: {
        id: updatedClient.id,
        firstName: updatedClient.firstName,
        lastName: updatedClient.lastName,
        leadScore: updatedClient.leadScore,
        leadPriority: updatedClient.leadPriority,
      },
    });
  } catch (error: any) {
    console.error("Erreur sauvegarde score:", error);
    return NextResponse.json(
      { error: "Erreur serveur", details: error.message },
      { status: 500 }
    );
  }
}
