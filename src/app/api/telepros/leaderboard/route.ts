import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const leaderboard = await prisma.userPoints.findMany({
      orderBy: { points: "desc" },
      take: 10,
      include: { user: { select: { name: true } } },
    });

    return NextResponse.json({ leaderboard });
  } catch (err) {
    console.error("telepros/leaderboard:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
