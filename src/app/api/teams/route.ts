import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const teams = await prisma.team.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ teams });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await request.json();
  const team = await prisma.team.create({ data: { name: body.name } });
  return NextResponse.json({ team }, { status: 201 });
}
