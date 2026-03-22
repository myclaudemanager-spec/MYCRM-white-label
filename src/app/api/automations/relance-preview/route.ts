import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const now = new Date();
  const today = now.toISOString().split("T")[0];

  // Récupérer les paramètres depuis les settings DB
  const settingsRows = await prisma.setting.findMany({
    where: { key: { in: ["relance_nrp_delay_h", "relance_faux_delay_h", "relance_pi_delay_d"] } },
  });
  const s: Record<string, string> = {};
  for (const r of settingsRows) s[r.key] = r.value;

  const nrpDelayH = parseInt(s["relance_nrp_delay_h"] || "48");
  const fauxDelayH = parseInt(s["relance_faux_delay_h"] || "48");
  const piDelayD = parseInt(s["relance_pi_delay_d"] || "90");

  const baseFilter = { frozen: false, deletedAt: null, archived: false,
    OR: [{ rdvDate: null }, { rdvDate: { lt: today } }] };

  const [nrpClients, fauxClients, piClients] = await Promise.all([
    prisma.client.findMany({
      where: { ...baseFilter, statusCall: "NRP",
        updatedAt: { lte: new Date(Date.now() - nrpDelayH * 3600 * 1000) } },
      select: { id: true, firstName: true, lastName: true, mobile: true, updatedAt: true, campaign: true },
    }),
    prisma.client.findMany({
      where: { ...baseFilter, statusCall: { in: ["FAUX NUM", "FAUX NUMERO"] },
        updatedAt: { lte: new Date(Date.now() - fauxDelayH * 3600 * 1000) } },
      select: { id: true, firstName: true, lastName: true, mobile: true, updatedAt: true, campaign: true },
    }),
    prisma.client.findMany({
      where: { ...baseFilter, statusCall: "PAS INTERESSE",
        updatedAt: { lte: new Date(Date.now() - piDelayD * 24 * 3600 * 1000) } },
      select: { id: true, firstName: true, lastName: true, mobile: true, updatedAt: true, campaign: true },
      take: 50,
    }),
  ]);

  return NextResponse.json({
    params: { nrpDelayH, fauxDelayH, piDelayD },
    counts: { nrp: nrpClients.length, faux: fauxClients.length, pi: piClients.length,
      total: nrpClients.length + fauxClients.length + piClients.length },
    preview: { nrp: nrpClients, faux: fauxClients, pi: piClients },
  });
}
