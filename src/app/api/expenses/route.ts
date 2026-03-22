import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const supplier = searchParams.get("supplier") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "25");

  const where: any = {};
  if (status) where.status = status;
  if (supplier) where.supplier = { contains: supplier };
  if (search) {
    where.OR = [
      { supplier: { contains: search } },
      { observation: { contains: search } },
      { client: { lastName: { contains: search } } },
    ];
  }

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: { client: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.expense.count({ where }),
  ]);

  return NextResponse.json({
    expenses,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await request.json();
  const expense = await prisma.expense.create({
    data: {
      date: body.date ? new Date(body.date) : null,
      supplier: body.supplier,
      status: body.status || "en_attente",
      bank: body.bank,
      amount: body.amount ? parseFloat(body.amount) : 0,
      matching: body.matching,
      observation: body.observation,
      clientId: body.clientId ? parseInt(body.clientId) : null,
    },
  });

  return NextResponse.json({ expense }, { status: 201 });
}
