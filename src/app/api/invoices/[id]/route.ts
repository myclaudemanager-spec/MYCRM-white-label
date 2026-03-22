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

  const invoice = await prisma.invoice.update({
    where: { id: parseInt(id) },
    data: {
      number: body.number,
      type: body.type,
      content: body.content,
      status: body.status,
      amount: body.amount ? parseFloat(body.amount) : undefined,
      bankTransId: body.bankTransId,
      clientId: body.clientId ? parseInt(body.clientId) : undefined,
    },
  });

  return NextResponse.json({ invoice });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Permission refusée" }, { status: 403 });

  const { id } = await params;
  await prisma.invoice.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ success: true });
}
