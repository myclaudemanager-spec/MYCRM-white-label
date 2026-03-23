import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// In-memory cache 2 min
interface DashboardCache {
  data: Record<string, unknown>;
  ts: number;
}
let dashboardCache: DashboardCache | null = null;
const CACHE_TTL = 2 * 60 * 1000;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Cache check
  if (dashboardCache && Date.now() - dashboardCache.ts < CACHE_TTL) {
    return NextResponse.json(dashboardCache.data);
  }

  const now = new Date();

  // Week boundaries (Monday to Sunday) — UTC to match rdvDate storage
  const dayOfWeek = now.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + mondayOffset));
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7);

  // Last week
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 7);

  // Month boundaries
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  // Today boundaries
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

  // Convert dates to ISO strings for rdvDate comparison (rdvDate is String in schema)
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekEndStr = weekEnd.toISOString().split('T')[0];
  const todayStartStr = todayStart.toISOString().split('T')[0];
  const tomorrowStartStr = tomorrowStart.toISOString().split('T')[0];
  const monthStartStr = monthStart.toISOString().split('T')[0];
  const monthEndStr = monthEnd.toISOString().split('T')[0];

  // ✅ CORRECTION : Tous les statuts RDV
  const RDV_STATUSES = [
    "RDV PRIS",
    "RDV CONFIRMÉ",
    "RDV CONFIRMÉ",
    "RDV SMS CONFIRMATION NRP 1",
    "VT PROGRAMMÉ",
    "VT"
  ];

  const [
    totalClients,
    clientsThisWeek,
    clientsLastWeek,
    rdvThisWeek,
    rdvConfirmedThisWeek,
    signaturesThisMonth,
    signaturesLastMonth,
    rdvToday,
    rdvTodayList,
    // Pipeline counts — full funnel
    leadsNew,
    leadsNRP,
    rdvPris,
    confirmes,
    signes,
    installationOk,
    payes,
    // Quick actions
    newLeads,
    aRappeler,
    nrp,
    // Recent actions
    recentActions,
    // Revenue
    totalInvoicesPaid,
    // ✅ CORRECTION : Top performers — tous les statuts RDV
    topTelepos,
    // Status distribution
    allStatuses,
  ] = await Promise.all([
    // Total clients
    prisma.client.count(),
    // Clients added this week
    prisma.client.count({ where: { createdAt: { gte: weekStart, lt: weekEnd } } }),
    // Clients added last week
    prisma.client.count({ where: { createdAt: { gte: lastWeekStart, lt: weekStart } } }),
    // RDV this week
    prisma.client.count({ where: { rdvDate: { gte: weekStartStr, lt: weekEndStr } } }),
    // RDV confirmed this week
    prisma.client.count({ where: { rdvDate: { gte: weekStartStr, lt: weekEndStr }, statusCall: "RDV CONFIRMÉ" } }),
    // Signatures this month
    prisma.action.count({ where: { type: "changement_statut", newStatus: { contains: "SIGNA" }, createdAt: { gte: monthStart, lt: monthEnd } } }),
    // Signatures last month
    prisma.action.count({ where: { type: "changement_statut", newStatus: { contains: "SIGNA" }, createdAt: { gte: lastMonthStart, lt: monthStart } } }),
    // RDV today count
    prisma.client.count({ where: { rdvDate: { gte: todayStartStr, lt: tomorrowStartStr } } }),
    // RDV today list
    prisma.client.findMany({
      where: { rdvDate: { gte: todayStartStr, lt: tomorrowStartStr } },
      select: {
        id: true, firstName: true, lastName: true, mobile: true, city: true,
        rdvTime: true, statusCall: true, statusRDV: true,
        telepos: { select: { name: true } },
        commercial1: { select: { name: true } },
      },
      orderBy: { rdvTime: "asc" },
    }),
    // Pipeline: NEW
    prisma.client.count({ where: { statusCall: "NEW" } }),
    // Pipeline: Leads / NRP
    prisma.client.count({ where: { OR: [{ statusCall: "NRP" }, { statusCall: { equals: null } }] } }),
    // Pipeline: RDV PRIS (statusCall, pas statusRDV)
    prisma.client.count({ where: { statusCall: "RDV PRIS" } }),
    // Pipeline: RDV CONFIRMÉ
    prisma.client.count({ where: { statusCall: "RDV CONFIRMÉ" } }),
    // Pipeline: SIGNÉ
    prisma.client.count({ where: { statusRDV: { contains: "SIGN" } } }),
    // Pipeline: INSTALLÉ
    prisma.client.count({ where: { statusRDV: { contains: "INSTALL" } } }),
    // Pipeline: PAYÉ
    prisma.client.count({ where: { statusRDV: { contains: "PAY" } } }),
    // Quick: NEW
    prisma.client.count({ where: { statusCall: "NEW" } }),
    // Quick: A RAPPELER + À REPLACER
    prisma.client.count({ where: { OR: [{ statusCall: "A RAPPELER" }, { statusRDV: "À REPLACER" }] } }),
    // Quick: NRP
    prisma.client.count({ where: { statusCall: "NRP" } }),
    // Recent activity — 15 latest
    prisma.action.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      include: {
        user: { select: { name: true } },
        client: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    // Revenue
    prisma.invoice.aggregate({ where: { status: "payé" }, _sum: { amount: true } }),
    // Top performers — compter les ACTIONS de prise de RDV par user (pas les clients assignés)
    prisma.action.groupBy({
      by: ["userId"],
      where: {
        type: "changement_statut",
        newStatus: "RDV PRIS",
        createdAt: { gte: monthStart, lt: monthEnd },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
    // Status distribution for chart
    prisma.client.groupBy({
      by: ["statusCall"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
  ]);

  // Resolve performer names (userId from actions, not teleposId)
  const performerIds = topTelepos.filter((t: any) => t.userId).map((t: any) => t.userId);
  const teleposUsers = performerIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: performerIds } }, select: { id: true, name: true } })
    : [];
  const teleposMap = Object.fromEntries(teleposUsers.map((u) => [u.id, u.name]));

  // Conversion rate
  const totalWithRDV = rdvPris + confirmes;
  const conversionRate = totalWithRDV > 0 ? Math.round((signaturesThisMonth / totalWithRDV) * 100) : 0;

  // Format recent actions
  const activities = recentActions.map((a: any) => {
    const timeDiff = now.getTime() - new Date(a.createdAt).getTime();
    const minutes = Math.floor(timeDiff / 60000);
    let timeLabel = "";
    if (minutes < 1) timeLabel = "À l'instant";
    else if (minutes < 60) timeLabel = `Il y a ${minutes} min`;
    else if (minutes < 1440) timeLabel = `Il y a ${Math.floor(minutes / 60)}h`;
    else timeLabel = `Il y a ${Math.floor(minutes / 1440)}j`;

    let actionLabel = "";
    if (a.type === "connexion") actionLabel = "s'est connecté";
    else if (a.type === "creation") actionLabel = "a créé";
    else if (a.type === "modification") actionLabel = "a modifié";
    else if (a.type === "changement_statut") actionLabel = "a changé le statut de";
    else if (a.type === "suppression") actionLabel = "a supprimé";
    else actionLabel = a.type;

    return {
      time: timeLabel,
      user: a.user?.name || "Système",
      action: actionLabel,
      target: a.client ? `${a.client.firstName || ""} ${a.client.lastName || ""}`.trim() : "",
      clientId: a.client?.id || null,
      detail: a.oldStatus && a.newStatus ? `${a.oldStatus} → ${a.newStatus}` : a.detail || "",
      type: a.type,
    };
  });

  // Build pipeline with full funnel
  const pipeline = [
    { label: "NEW", count: leadsNew, color: "bg-blue-600", textColor: "text-blue-700", bgLight: "bg-blue-50" },
    { label: "À Contacter", count: leadsNRP, color: "bg-orange-500", textColor: "text-orange-700", bgLight: "bg-orange-50" },
    { label: "RDV Pris", count: rdvPris, color: "bg-blue-500", textColor: "text-blue-700", bgLight: "bg-blue-50" },
    { label: "Confirmés", count: confirmes, color: "bg-cyan-500", textColor: "text-cyan-700", bgLight: "bg-cyan-50" },
    { label: "Signés", count: signes, color: "bg-green-500", textColor: "text-green-700", bgLight: "bg-green-50" },
    { label: "Installés", count: installationOk, color: "bg-purple-500", textColor: "text-purple-700", bgLight: "bg-purple-50" },
    { label: "Payés", count: payes, color: "bg-emerald-600", textColor: "text-emerald-700", bgLight: "bg-emerald-50" },
  ];

  const maxPipeline = Math.max(...pipeline.map((p) => p.count), 1);
  const pipelineWithWidth = pipeline.map((p) => ({
    ...p,
    width: `${Math.max(Math.round((p.count / maxPipeline) * 100), 4)}%`,
  }));

  // Status distribution
  const statusChart = allStatuses
    .filter((s: any) => s.statusCall !== null)
    .map((s: any) => ({
      name: s.statusCall || "Sans statut",
      count: s._count.id,
    }));

  // Top performers formatted
  const performers = topTelepos.map((t: any) => ({
    name: teleposMap[t.userId] || `User #${t.userId}`,
    count: t._count.id,
  }));

  const weekDiff = clientsThisWeek - clientsLastWeek;
  const signDiff = signaturesThisMonth - signaturesLastMonth;
  const revenue = totalInvoicesPaid._sum.amount || 0;

  const responseData = {
    stats: {
      totalClients,
      clientsChange: weekDiff >= 0 ? `+${clientsThisWeek} cette semaine` : `${clientsThisWeek} cette semaine`,
      rdvThisWeek,
      rdvConfirmedThisWeek,
      signaturesThisMonth,
      signatureChange: signDiff >= 0 ? `+${signDiff} vs mois dernier` : `${signDiff} vs mois dernier`,
      conversionRate,
      revenue,
      rdvToday,
    },
    pipeline: pipelineWithWidth,
    quickActions: {
      new: newLeads,
      aRappeler,
      rdvToday,
      aConfirmer: rdvPris,
      nrp,
    },
    rdvTodayList,
    activities,
    statusChart,
    performers,
  };
  dashboardCache = { data: responseData, ts: Date.now() };
  return NextResponse.json(responseData);
}
