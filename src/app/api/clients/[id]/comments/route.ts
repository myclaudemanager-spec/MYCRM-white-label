import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

interface ClientComment {
  id: string;
  date: string;
  userId: number;
  userName: string;
  text: string;
}

// POST /api/clients/[id]/comments - Ajouter un commentaire
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const clientId = parseInt(id);

  try {
    const body = await request.json();
    const text = body.text?.trim();
    if (!text) return NextResponse.json({ error: "Texte requis" }, { status: 400 });

    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, clientComments: true } });
    if (!client) return NextResponse.json({ error: "Client non trouvé" }, { status: 404 });

    const existing: ClientComment[] = client.clientComments ? JSON.parse(client.clientComments) : [];

    const newComment: ClientComment = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      text,
    };

    const updated = [newComment, ...existing];
    await prisma.client.update({ where: { id: clientId }, data: { clientComments: JSON.stringify(updated) } });

    return NextResponse.json({ comment: newComment });
  } catch (error) {
    console.error("Add comment error:", error);
    return NextResponse.json({ error: "Erreur lors de l'ajout" }, { status: 500 });
  }
}

// DELETE /api/clients/[id]/comments?commentId=xxx - Supprimer un commentaire (admin uniquement)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Réservé aux admins" }, { status: 403 });
  }

  const { id } = await params;
  const clientId = parseInt(id);
  const commentId = request.nextUrl.searchParams.get("commentId");

  if (!commentId) return NextResponse.json({ error: "commentId requis" }, { status: 400 });

  try {
    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, clientComments: true } });
    if (!client) return NextResponse.json({ error: "Client non trouvé" }, { status: 404 });

    const existing: ClientComment[] = client.clientComments ? JSON.parse(client.clientComments) : [];
    const filtered = existing.filter(c => c.id !== commentId);

    await prisma.client.update({ where: { id: clientId }, data: { clientComments: JSON.stringify(filtered) } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete comment error:", error);
    return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 });
  }
}
