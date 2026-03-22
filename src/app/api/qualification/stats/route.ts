import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    // Vérifier authentification
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Date limite : 7 derniers jours par défaut
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Compter les leads qualifiés (derniers 7 jours)
    const qualifiedCount = await prisma.client.count({
      where: {
        qualifiedAt: {
          gte: sevenDaysAgo,
        },
      },
    });

    // Compter les leads disqualifiés (derniers 7 jours)
    const disqualifiedCount = await prisma.client.count({
      where: {
        disqualifiedAt: {
          gte: sevenDaysAgo,
        },
      },
    });

    // Total leads traités (avec qualification ou disqualification)
    const totalProcessed = qualifiedCount + disqualifiedCount;

    // Taux de qualification (%)
    const qualificationRate = totalProcessed > 0
      ? (qualifiedCount / totalProcessed) * 100
      : 0;

    // Temps moyen de qualification (millisecondes)
    const clientsWithTime = await prisma.client.findMany({
      where: {
        qualificationTime: {
          not: null,
        },
        OR: [
          { qualifiedAt: { gte: sevenDaysAgo } },
          { disqualifiedAt: { gte: sevenDaysAgo } },
        ],
      },
      select: {
        qualificationTime: true,
      },
    });

    const avgQualificationTime = clientsWithTime.length > 0
      ? clientsWithTime.reduce((sum, c) => sum + (c.qualificationTime || 0), 0) / clientsWithTime.length
      : 0;

    // Motifs de disqualification (top 3)
    const disqualificationReasons = await prisma.client.groupBy({
      by: ['disqualificationReason'],
      where: {
        disqualifiedAt: {
          gte: sevenDaysAgo,
        },
        disqualificationReason: {
          not: null,
        },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 3,
    });

    const topDisqualificationReasons = disqualificationReasons.map(r => ({
      reason: r.disqualificationReason,
      count: r._count.id,
      percentage: disqualifiedCount > 0
        ? ((r._count.id / disqualifiedCount) * 100).toFixed(1)
        : "0",
    }));

    // Funnel de conversion
    const newLeadsCount = await prisma.client.count({
      where: {
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
    });

    const rdvPrisCount = await prisma.client.count({
      where: {
        statusCall: "RDV PRIS",
        qualifiedAt: {
          gte: sevenDaysAgo,
        },
      },
    });

    const signeCount = await prisma.client.count({
      where: {
        statusRDV: {
          contains: "SIGNÉ",
        },
        qualifiedAt: {
          gte: sevenDaysAgo,
        },
      },
    });

    // Performance par téléprospecteur (top 5)
    const teleposPerformance = await prisma.client.groupBy({
      by: ['teleposId'],
      where: {
        OR: [
          { qualifiedAt: { gte: sevenDaysAgo } },
          { disqualifiedAt: { gte: sevenDaysAgo } },
        ],
        teleposId: {
          not: null,
        },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 5,
    });

    // Récupérer les noms des téléprospecteurs
    const teleposPerformanceWithNames = await Promise.all(
      teleposPerformance.map(async (tp) => {
        const telepos = await prisma.user.findUnique({
          where: { id: tp.teleposId! },
          select: { name: true },
        });

        const qualified = await prisma.client.count({
          where: {
            teleposId: tp.teleposId,
            qualifiedAt: { gte: sevenDaysAgo },
          },
        });

        const disqualified = await prisma.client.count({
          where: {
            teleposId: tp.teleposId,
            disqualifiedAt: { gte: sevenDaysAgo },
          },
        });

        return {
          teleposName: telepos?.name || "Inconnu",
          totalProcessed: tp._count.id,
          qualified,
          disqualified,
          qualificationRate: tp._count.id > 0
            ? ((qualified / tp._count.id) * 100).toFixed(1)
            : "0",
        };
      })
    );

    // Calcul CPL (simulation - dans la réalité, récupérer depuis Facebook API)
    // Pour l'instant, on suppose un CPL moyen de 60 AED
    const avgCPL = 60; // AED
    const cplQualifie = qualifiedCount > 0 ? avgCPL : 0;
    const cplGlobal = newLeadsCount > 0 ? avgCPL : 0;
    const economieParLead = cplGlobal - cplQualifie;
    const economieMensuelle = economieParLead * qualifiedCount * 4; // 4 semaines

    // Évolution quotidienne (7 derniers jours)
    const dailyEvolution = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayQualified = await prisma.client.count({
        where: {
          qualifiedAt: {
            gte: date,
            lt: nextDate,
          },
        },
      });

      const dayDisqualified = await prisma.client.count({
        where: {
          disqualifiedAt: {
            gte: date,
            lt: nextDate,
          },
        },
      });

      const dayTotal = dayQualified + dayDisqualified;
      const dayRate = dayTotal > 0 ? (dayQualified / dayTotal) * 100 : 0;

      dailyEvolution.push({
        date: date.toISOString().split('T')[0],
        qualified: dayQualified,
        disqualified: dayDisqualified,
        total: dayTotal,
        rate: parseFloat(dayRate.toFixed(1)),
      });
    }

    return NextResponse.json({
      overview: {
        totalProcessed,
        qualifiedCount,
        disqualifiedCount,
        qualificationRate: parseFloat(qualificationRate.toFixed(1)),
        avgQualificationTime: Math.round(avgQualificationTime), // ms
        avgQualificationTimeSeconds: parseFloat((avgQualificationTime / 1000).toFixed(1)), // s
      },
      cpl: {
        cplQualifie,
        cplGlobal,
        economieParLead,
        economieMensuelle: Math.round(economieMensuelle),
      },
      funnel: {
        newLeads: newLeadsCount,
        qualified: qualifiedCount,
        rdvPris: rdvPrisCount,
        signe: signeCount,
        conversionQualifiedToRDV: qualifiedCount > 0
          ? parseFloat(((rdvPrisCount / qualifiedCount) * 100).toFixed(1))
          : 0,
        conversionRDVToSigne: rdvPrisCount > 0
          ? parseFloat(((signeCount / rdvPrisCount) * 100).toFixed(1))
          : 0,
      },
      topDisqualificationReasons,
      teleposPerformance: teleposPerformanceWithNames,
      dailyEvolution,
    });
  } catch (error) {
    console.error("❌ Erreur qualification stats:", error);
    return NextResponse.json(
      { error: "Erreur lors du calcul des statistiques" },
      { status: 500 }
    );
  }
}
