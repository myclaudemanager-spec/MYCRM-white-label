import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import prisma from "./prisma";

const JWT_SECRET = process.env.JWT_SECRET;

// Fail fast au démarrage si JWT_SECRET n'est pas configuré en production
if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("[AUTH] JWT_SECRET is required in production. Set it in your .env file.");
}

export interface JWTPayload {
  userId: number;
  login: string;
  role: string;
  name: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      login: true,
      name: true,
      email: true,
      role: true,
      team: true,
      permissions: true,
      restrictions: true,
    },
  });

  return user;
}

export function hasPermission(user: { permissions: string }, permission: string): boolean {
  try {
    const perms = JSON.parse(user.permissions);
    return !!perms[permission];
  } catch {
    return false;
  }
}
