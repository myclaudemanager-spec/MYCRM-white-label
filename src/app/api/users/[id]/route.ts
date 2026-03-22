import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const updateData: any = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.email !== undefined) updateData.email = body.email;
  if (body.login !== undefined) updateData.login = body.login;
  if (body.role !== undefined) updateData.role = body.role;
  if (body.team !== undefined) updateData.team = body.team;
  if (body.active !== undefined) updateData.active = body.active;
  if (body.password) updateData.password = await hashPassword(body.password);

  const updated = await prisma.user.update({
    where: { id: parseInt(id) },
    data: updateData,
    select: { id: true, name: true, login: true, email: true, role: true, team: true, active: true },
  });

  return NextResponse.json({ user: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const userId = parseInt(id);

  // Don't allow deleting yourself
  if (userId === user.id) {
    return NextResponse.json({ error: "Impossible de supprimer votre propre compte" }, { status: 400 });
  }

  // Soft delete (deactivate)
  await prisma.user.update({
    where: { id: userId },
    data: { active: false },
  });

  return NextResponse.json({ success: true });
}
