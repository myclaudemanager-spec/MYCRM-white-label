import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// GET /api/actions - List activity log
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const clientSearch = searchParams.get("client") || "";
  const actionType = searchParams.get("type") || "";
  const userId = searchParams.get("userId") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");

  const where: any = {};

  if (actionType) where.type = actionType;
  if (userId) where.userId = parseInt(userId);
  if (clientSearch) {
    where.client = {
      OR: [
        { firstName: { contains: clientSearch } },
        { lastName: { contains: clientSearch } },
      ],
    };
  }

  const [actions, total] = await Promise.all([
    prisma.action.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        client: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.action.count({ where }),
  ]);

  return NextResponse.json({
    actions,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
