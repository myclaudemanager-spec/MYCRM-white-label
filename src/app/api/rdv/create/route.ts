import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      clientId,
      rdvDate,
      rdvTime,
      rdvDuration,
      typeRDV,
      commercial1Id,
      commercial2Id,
      infosRDV,
    } = body;

    // Validation
    if (!clientId || !rdvDate || !rdvTime) {
      return NextResponse.json(
        { error: "Client, date et heure requis" },
        { status: 400 }
      );
    }

    // Vérifier que le client existe
    const client = await prisma.client.findUnique({
      where: { id: parseInt(clientId) },
    });

    if (!client) {
      return NextResponse.json(
        { error: "Client introuvable" },
        { status: 404 }
      );
    }

    // Créer/mettre à jour le RDV
    const updated = await prisma.client.update({
      where: { id: parseInt(clientId) },
      data: {
        rdvDate,
        rdvTime,
        rdvDuration: rdvDuration ? String(rdvDuration) : null,
        rdvCreatedDate: new Date(),
        typeRDV: typeRDV || null,
        commercial1Id: commercial1Id ? parseInt(commercial1Id) : null,
        commercial2Id: commercial2Id ? parseInt(commercial2Id) : null,
        infosRDV: infosRDV || null,
        // Si le client n'a pas de statusCall, on met "RDV PRIS"
        statusCall: client.statusCall || "RDV PRIS",
      },
    });

    return NextResponse.json({
      success: true,
      client: updated,
    });
  } catch (error: any) {
    console.error("Erreur création RDV:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
