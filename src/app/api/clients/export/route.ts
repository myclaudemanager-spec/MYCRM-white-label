import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

// GET /api/clients/export - Export all clients as CSV
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const statusCall = searchParams.get("statusCall") || "";
  const statusRDV = searchParams.get("statusRDV") || "";

  const where: Prisma.ClientWhereInput = {};
  if (search) {
    where.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { mobile: { contains: search } },
      { email: { contains: search } },
      { city: { contains: search } },
    ];
  }
  if (statusCall) where.statusCall = statusCall;
  if (statusRDV) where.statusRDV = statusRDV;

  const clients = await prisma.client.findMany({
    where,
    include: {
      commercial1: { select: { name: true } },
      commercial2: { select: { name: true } },
      telepos: { select: { name: true } },
    },
    orderBy: { id: "desc" },
  });

  // CSV Headers
  const headers = [
    "ID", "Référence client", "ID ancien système", "Civilité", "Nom", "Prénom", "Adresse", "Code postal", "Ville",
    "Mobile", "Téléphone 1", "Téléphone 2", "E-mail", "Observation",
    "Statut Call", "Statut RDV", "Commercial 1", "Commercial 2", "Télépro",
    "Équipe", "Campagne",
    "Date RDV", "Heure RDV", "Confirmé avec", "Rapport commerciale", "Infos RDV",
    "Propriétaire depuis", "Type bien", "Surface", "Compteur", "Chauffage",
    "Piscine", "Voiture élec.", "Facture élec.", "Orientation toiture", "Surface toiture",
    "Zone ABF", "Situation familiale", "Âge Mr", "Âge Mme", "Situation Mr", "Situation Mme",
    "Enfants", "Revenu foyer", "Crédit en cours", "Financement",
    "Société", "Banque", "Puissance", "Montant total", "Prix cession",
    "Survente", "CQ Yoran", "Date installation", "Nombre de produits", "Produits vendus",
    "Facture HT", "Facture TTC", "Commission HT", "Commission TTC",
    "Déduction", "Frais annexes", "Commission télépro", "Commission final", "Marge BH",
    "Autoconsommation", "Récup. TVA", "Prime Rénov", "CEE",
    "Date création", "Date modification",
  ];

  function escapeCSV(val: unknown): string {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function formatDate(d: Date | string | null): string {
    if (!d) return "";
    return new Date(d).toLocaleDateString("fr-FR");
  }

  const rows = clients.map((c) => [
    c.id, c.refClient, c.oldId, c.civilite, c.lastName, c.firstName, c.address, c.zipCode, c.city,
    c.mobile, c.phone1, c.phone2, c.email, c.observation,
    c.statusCall, c.statusRDV, c.commercial1?.name, c.commercial2?.name, c.telepos?.name,
    c.team, c.campaign,
    formatDate(c.rdvDate), c.rdvTime, c.confirmedWith, c.rapportCommerciale, c.infosRDV,
    c.ownerSince, c.propertyType, c.surface, c.counter, c.heatingSystem,
    c.pool ? "Oui" : "Non", c.electricCar ? "Oui" : "Non", c.electricBill, c.roofOrientation, c.roofSpace,
    c.zoneABF ? "Oui" : "Non", c.familyStatus, c.ageMr, c.ageMme, c.situationMr, c.situationMme,
    c.children, c.householdIncome, c.currentCredit, c.financing,
    c.societe, c.bank, c.power, c.totalAmount, c.cessionPrice,
    c.oversell, c.cqYoran, formatDate(c.installDate), c.productCount, c.products,
    c.invoiceHT, c.invoiceTTC, c.commissionHT, c.commissionTTC,
    c.deductionType, c.annexFees, c.commissionTelepos, c.commissionFinal, c.marginBH,
    c.autoConsumption, c.tvaRecovery, c.primeRenov, c.cee,
    formatDate(c.createdAt), formatDate(c.updatedAt),
  ]);

  // BOM for Excel UTF-8 compatibility
  const BOM = "\uFEFF";
  const csv = BOM + headers.map(escapeCSV).join(";") + "\n" +
    rows.map((row) => row.map(escapeCSV).join(";")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="export-${clients.length}-clients.csv"`,
    },
  });
}
