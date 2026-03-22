import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const statuses = await prisma.status.findMany({
    orderBy: [{ type: "asc" }, { order: "asc" }],
  });
  return NextResponse.json({ statuses });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await request.json();
  const count = await prisma.status.count({ where: { type: body.type } });
  const status = await prisma.status.create({
    data: { name: body.name, color: body.color || "#3b82f6", type: body.type, order: count, category: body.category },
  });
  return NextResponse.json({ status }, { status: 201 });
}
