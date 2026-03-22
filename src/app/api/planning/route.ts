import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { decryptClient } from "@/lib/encryption";

// Helper: format date as YYYY-MM-DD in UTC
function toLocalDateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// GET /api/planning?weekStart=2026-02-09
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const weekStartStr = searchParams.get("weekStart") || "";
  const statusCall = searchParams.get("statusCall") || "";
  const statusRDV = searchParams.get("statusRDV") || "";
  const team = searchParams.get("team") || "";
  const typeRDV = searchParams.get("typeRDV") || "";
  const commercialId = searchParams.get("commercialId") || "";

  let weekStart: Date;
  if (weekStartStr) {
    weekStart = new Date(weekStartStr + "T00:00:00.000Z");
  } else {
    const now = new Date();
    const utcDay = now.getUTCDay();
    const diff = utcDay === 0 ? -6 : 1 - utcDay;
    weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff));
  }

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const weekStartISO = weekStart.toISOString().split("T")[0];
  const weekEndISO = weekEnd.toISOString().split("T")[0];

  // Build where clause — exclude deleted clients
  const where: any = {
    rdvDate: { gte: weekStartISO, lt: weekEndISO },
    deletedAt: null,
  };

  if (statusCall) where.statusCall = statusCall;
  if (statusRDV) where.statusRDV = statusRDV;
  if (team) where.team = team;
  if (typeRDV) where.typeRDV = typeRDV;
  // Filtre commercial : le commercial ne voit que SES RDV
  if (commercialId) where.commercial1Id = parseInt(commercialId);

  // Single query with includes (no N+1)
  const clients = await prisma.client.findMany({
    where,
    orderBy: { rdvTime: 'asc' },
    include: {
      commercial1: { select: { id: true, name: true } },
      commercial2: { select: { id: true, name: true } },
      telepos: { select: { id: true, name: true } },
    },
  });

  // Decrypt and prepare response
  const decryptedClients = clients.map((client) => {
    const decrypted = decryptClient(client as any);
    return {
      ...decrypted,
      commercial1: client.commercial1,
      commercial2: client.commercial2,
      telepos: client.telepos,
    };
  });

  // Generate 7 day keys
  const days: Record<string, unknown[]> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + i);
    days[toLocalDateKey(d)] = [];
  }

  // Group clients by rdvDate
  for (const client of decryptedClients) {
    if (client.rdvDate) {
      const key = toLocalDateKey(new Date(client.rdvDate + "T00:00:00.000Z"));
      if (days[key]) {
        days[key].push(client);
      }
    }
  }

  return NextResponse.json({ weekStart: weekStart.toISOString(), days });
}
