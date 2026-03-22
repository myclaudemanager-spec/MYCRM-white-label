import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/notifications
 * Récupérer les notifications non lues de l'utilisateur
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
        read: false
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            city: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 50
    });

    return NextResponse.json({
      notifications,
      unreadCount: notifications.length
    });
  } catch (error: unknown) {
    console.error("Erreur récupération notifications:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/notifications
 * Marquer une ou toutes les notifications comme lues
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, all } = body;

    if (all) {
      // Marquer toutes les notifications comme lues
      await prisma.notification.updateMany({
        where: {
          userId: user.id,
          read: false
        },
        data: {
          read: true
        }
      });
    } else if (id) {
      // Marquer une notification spécifique comme lue
      await prisma.notification.updateMany({
        where: {
          id: id,
          userId: user.id // Sécurité
        },
        data: {
          read: true
        }
      });
    } else {
      return NextResponse.json(
        { error: "Paramètre 'id' ou 'all' requis" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Erreur mise à jour notifications:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
