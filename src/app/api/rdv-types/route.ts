import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const rdvTypes = await prisma.rDVType.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ rdvTypes });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await request.json();
  const rdvType = await prisma.rDVType.create({ data: { name: body.name, color: body.color || "#3b82f6" } });
  return NextResponse.json({ rdvType }, { status: 201 });
}
