import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { decryptClient } from "@/lib/encryption";
import type { Prisma } from "@prisma/client";

// GET /api/clients - List all clients with filters
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const statusCall = searchParams.get("statusCall") || "";
  const statusRDV = searchParams.get("statusRDV") || "";
  const team = searchParams.get("team") || "";
  const campaign = searchParams.get("campaign") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "25");
  const sortBy = searchParams.get("sortBy") || "clientNumber"; // Par numéro client par défaut
  const sortOrder = searchParams.get("sortOrder") || "desc";
  const rappelToday = searchParams.get("rappelToday") === "true";

  // Today range for rappel filter
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // Build where clause
  const where: Prisma.ClientWhereInput = {
    deletedAt: null, // Exclure les clients soft-deleted
  };

  if (rappelToday) {
    where.rappelDate = { gte: todayStart, lte: todayEnd };
  }

  if (search) {
    const orClauses: Prisma.ClientWhereInput[] = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { mobile: { contains: search } },
      { phone1: { contains: search } },
      { email: { contains: search } },
      { city: { contains: search } },
      { zipCode: { contains: search } },
    ];
    // Recherche par numéro client (si c'est un nombre)
    const numSearch = parseInt(search);
    if (!isNaN(numSearch)) {
      orClauses.push({ clientNumber: numSearch });
    }
    // Recherche par nom complet (ex: "Jean Dupont")
    const parts = search.trim().split(/\s+/).filter(p => p.length > 0);
    if (parts.length >= 2) {
      orClauses.push({ AND: [{ firstName: { contains: parts[0] } }, { lastName: { contains: parts.slice(1).join(' ') } }] });
      orClauses.push({ AND: [{ lastName: { contains: parts[0] } }, { firstName: { contains: parts.slice(1).join(' ') } }] });
    }
    where.OR = orClauses;
  }

  if (statusCall) where.statusCall = statusCall;
  if (statusRDV) where.statusRDV = statusRDV;
  if (team) where.team = team;
  if (campaign) where.campaign = campaign;

  // Telepos : voient leurs leads assignés + NRP en pot commun
  if (user.role === "telepos") {
    const teleposFilter: Prisma.ClientWhereInput = {
      OR: [{ teleposId: user.id }, { statusCall: "NRP" }],
    };
    // Si une recherche texte a déjà posé un OR, combiner via AND
    if (where.OR) {
      const searchOr = where.OR;
      delete where.OR;
      where.AND = [{ OR: searchOr }, teleposFilter];
    } else {
      where.OR = teleposFilter.OR;
    }
  }

  // Tri : rappelToday → forcer rappelTime ASC, sinon tri normal
  const orderBy: Prisma.ClientOrderByWithRelationInput = rappelToday
    ? { rappelTime: "asc" }
    : { [sortBy]: sortOrder };

  const [clients, total, rappelTodayCount] = await Promise.all([
    prisma.client.findMany({
      where,
      include: {
        commercial1: { select: { id: true, name: true } },
        commercial2: { select: { id: true, name: true } },
        telepos: { select: { id: true, name: true } },
        callLogs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { comment: true, result: true, createdAt: true, callTime: true },
        },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.client.count({ where }),
    // Toujours retourner le count rappels aujourd'hui pour le badge
    prisma.client.count({
      where: { rappelDate: { gte: todayStart, lte: todayEnd }, deletedAt: null, archived: false },
    }),
  ]);

  // 🔓 DÉCHIFFRER tous les clients avant de les envoyer au frontend
  const decryptedClients = clients.map(client => decryptClient(client));

  return NextResponse.json({
    clients: decryptedClients,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    rappelTodayCount,
  });
}

// POST /api/clients - Create a new client
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const body = await request.json();

    // Auto-assign sequential clientNumber
    const maxNumResult = await prisma.client.aggregate({ _max: { clientNumber: true } });
    const nextClientNumber = (maxNumResult._max.clientNumber ?? 0) + 1;

    const client = await prisma.client.create({
      data: {
        clientNumber: nextClientNumber,
        // Identité
        civilite: body.civilite,
        firstName: body.firstName,
        lastName: body.lastName,

        // Contact
        address: body.address,
        zipCode: body.zipCode,
        city: body.city,
        mobile: body.mobile,
        phone1: body.phone1,
        phone2: body.phone2,
        email: body.email,

        // Statuts et équipe
        observation: body.observation,
        statusCall: body.statusCall || "NEW", // Statut NEW par défaut
        statusRDV: body.statusRDV,
        team: body.team,
        campaign: body.campaign,
        commercial1Id: body.commercial1Id ? parseInt(body.commercial1Id) : null,
        commercial2Id: body.commercial2Id ? parseInt(body.commercial2Id) : null,
        teleposId: body.teleposId ? parseInt(body.teleposId) : null,

        // Rendez-vous
        rdvDate: body.rdvDate,
        rdvTime: body.rdvTime,
        vtDate: body.vtDate,
        vtTime: body.vtTime,
        rappelDate: body.rappelDate,
        rappelTime: body.rappelTime,
        confirmedWith: body.confirmedWith,
        rapportCommerciale: body.rapportCommerciale,
        infosRDV: body.infosRDV,
        typeRDV: body.typeRDV,
        rdvDuration: body.rdvDuration,

        // Profil logement (CRITIQUES pour scoring)
        isOwner: body.isOwner,              // ← FIX: CRITIQUE pour scoring
        ownerSince: body.ownerSince,
        propertyType: body.propertyType,
        surface: body.surface,
        counter: body.counter,
        heatingSystem: body.heatingSystem,
        pool: body.pool === true || body.pool === "true",
        electricCar: body.electricCar === true || body.electricCar === "true",
        electricBill: body.electricBill,
        roofOrientation: body.roofOrientation,
        roofSpace: body.roofSpace,
        zoneABF: body.zoneABF === true || body.zoneABF === "true",

        // Famille
        familyStatus: body.familyStatus,
        ageMr: body.ageMr,
        ageMme: body.ageMme,
        situationMr: body.situationMr,
        situationMme: body.situationMme,
        children: body.children,
        householdIncome: body.householdIncome,

        // Financement
        currentCredit: body.currentCredit ? parseInt(body.currentCredit) : 0,
        financing: body.financing,
        societe: body.societe,
        bank: body.bank,

        // Technique
        power: body.power,
        totalAmount: body.totalAmount,
        cessionPrice: body.cessionPrice,
        oversell: body.oversell,
        cqYoran: body.cqYoran,
        installDate: body.installDate,

        // Facturation
        invoiceHT: body.invoiceHT ? parseFloat(body.invoiceHT) : 0,
        invoiceTTC: body.invoiceTTC ? parseFloat(body.invoiceTTC) : 0,
        commissionHT: body.commissionHT ? parseFloat(body.commissionHT) : 0,
        commissionTTC: body.commissionTTC ? parseFloat(body.commissionTTC) : 0,
        deductionType: body.deductionType,
        annexFees: body.annexFees,
        commissionTelepos: body.commissionTelepos ? parseFloat(body.commissionTelepos) : 0,
        commissionFinal: body.commissionFinal,
        marginBH: body.marginBH,

        // Énergie
        autoConsumption: body.autoConsumption,
        tvaRecovery: body.tvaRecovery,
        primeRenov: body.primeRenov,
        cee: body.cee,

        // Historique
        callHistory: body.callHistory,
        statusHistory: body.statusHistory,
        refClient: body.refClient,
        missedCalls: body.missedCalls ? parseInt(body.missedCalls) : 0,

        // Produits
        products: body.products,
        productCount: body.productCount ? parseInt(body.productCount) : 0,

        // Facebook Lead Ads
        fbLeadId: body.fbLeadId,
        fbCampaignId: body.fbCampaignId,
        fbCampaignName: body.fbCampaignName,
        fbAdSetId: body.fbAdSetId,
        fbAdSetName: body.fbAdSetName,
        fbAdId: body.fbAdId,
        fbAdName: body.fbAdName,
        fbFormId: body.fbFormId,
        fbFormName: body.fbFormName,
        fbLeadCreatedTime: body.fbLeadCreatedTime,

        // Traçabilité source
        sourceType: body.sourceType,
        sourceMetadata: body.sourceMetadata,
        validationStatus: body.validationStatus,
      },
    });

    // Log action
    await prisma.action.create({
      data: {
        type: "creation",
        detail: `Nouveau client créé: ${body.firstName} ${body.lastName}`,
        userId: user.id,
        clientId: client.id,
      },
    });

    // Notification au télépos assigné (nouveau lead)
    if (client.teleposId) {
      await prisma.notification.create({
        data: {
          userId: client.teleposId,
          type: "new_lead",
          title: `Nouveau lead: ${body.lastName || ""} ${body.firstName || ""}`.trim(),
          message: `Un nouveau lead vous a été assigné${body.campaign ? ` (campagne: ${body.campaign})` : ""}.`,
          clientId: client.id,
        },
      });
    }

    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    console.error("Create client error:", error);
    return NextResponse.json({ error: "Erreur lors de la création" }, { status: 500 });
  }
}
