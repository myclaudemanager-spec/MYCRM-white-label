import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const expense = await prisma.expense.update({
    where: { id: parseInt(id) },
    data: {
      date: body.date ? new Date(body.date) : null,
      supplier: body.supplier,
      status: body.status,
      bank: body.bank,
      amount: body.amount ? parseFloat(body.amount) : 0,
      matching: body.matching,
      observation: body.observation,
      clientId: body.clientId ? parseInt(body.clientId) : null,
    },
  });

  return NextResponse.json({ expense });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.expense.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ success: true });
}
