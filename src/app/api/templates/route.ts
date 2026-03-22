import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "";
  const search = searchParams.get("search") || "";

  const where: Prisma.TemplateWhereInput = {};
  if (type) where.type = type;
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { subject: { contains: search } },
    ];
  }

  const templates = await prisma.template.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ templates });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json();
  const template = await prisma.template.create({
    data: {
      name: body.name,
      type: body.type || "email_text",
      subject: body.subject,
      content: body.content || "",
      autoSend: body.autoSend || false,
      triggerOn: body.triggerOn,
    },
  });

  return NextResponse.json({ template }, { status: 201 });
}
