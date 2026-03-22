import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { decryptUser } from "@/lib/encryption";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const users = await prisma.user.findMany({
    select: { id: true, name: true, login: true, email: true, role: true, team: true, active: true, createdAt: true },
    orderBy: { name: "asc" },
  });

  // Déchiffrer les emails
  const decryptedUsers = users.map(u => decryptUser(u));

  return NextResponse.json({ users: decryptedUsers });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json();
  if (!body.login || !body.name || !body.email || !body.password) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  const hashedPassword = await hashPassword(body.password);

  const newUser = await prisma.user.create({
    data: {
      login: body.login,
      name: body.name,
      email: body.email,
      password: hashedPassword,
      role: body.role || "commercial",
      team: body.team || null,
      active: true,
    },
    select: { id: true, name: true, login: true, email: true, role: true, team: true, active: true },
  });

  return NextResponse.json({ user: newUser }, { status: 201 });
}
