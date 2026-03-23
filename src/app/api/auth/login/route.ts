import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPassword, createToken, hashPassword } from "@/lib/auth";

// ── Rate limiting en mémoire ────────────────────────────────────────────────
// Max 5 tentatives échouées par IP sur 15 minutes → blocage 15 min
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 min
const RATE_LIMIT_BLOCK_MS = 15 * 60 * 1000;  // 15 min

interface RateLimitEntry { count: number; firstAttempt: number; blockedUntil?: number; }
const loginAttempts = new Map<string, RateLimitEntry>();

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function checkRateLimit(ip: string): { blocked: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry) return { blocked: false };

  if (entry.blockedUntil && now < entry.blockedUntil) {
    return { blocked: true, retryAfterSec: Math.ceil((entry.blockedUntil - now) / 1000) };
  }
  // Reset si la fenêtre est expirée
  if (now - entry.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.delete(ip);
    return { blocked: false };
  }
  return { blocked: false };
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    return;
  }
  entry.count++;
  if (entry.count >= RATE_LIMIT_MAX) {
    entry.blockedUntil = now + RATE_LIMIT_BLOCK_MS;
    console.warn(`[RATE LIMIT] IP ${ip} bloquée pour 15 min (${entry.count} échecs)`);
  }
}

function clearFailedAttempts(ip: string): void {
  loginAttempts.delete(ip);
}
// ───────────────────────────────────────────────────────────────────────────

async function ensureAdminExists() {
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    const adminLogin = process.env.ADMIN_LOGIN || "admin";
    const adminPassword = process.env.ADMIN_PASSWORD || "changeme";
    const adminName = process.env.ADMIN_NAME || "Administrateur";
    console.log(`[INIT] No users found, creating admin user: ${adminLogin}`);
    const hashedPassword = await hashPassword(adminPassword);
    await prisma.user.create({
      data: {
        login: adminLogin,
        name: adminName,
        email: `${adminLogin}@localhost`,
        password: hashedPassword,
        role: "admin",
        active: true,
        permissions: JSON.stringify({
          clients: true,
          planning: true,
          utilisateurs: true,
          actions: true,
          modeles: true,
          factures: true,
          depenses: true,
          reglages: true,
          export: true,
          import: true,
        }),
      },
    });
    console.log(`[INIT] Admin user ${adminLogin} created successfully`);
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // Vérifier rate limit AVANT de traiter la requête
  const rl = checkRateLimit(ip);
  if (rl.blocked) {
    console.warn(`[RATE LIMIT] Tentative bloquée depuis IP ${ip} (retry in ${rl.retryAfterSec}s)`);
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans 15 minutes." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  try {
    const body = await request.json();
    const login = typeof body.login === "string" ? body.login.trim() : body.login;
    const password = body.password;

    console.log(`[LOGIN ATTEMPT] login="${login}" ip=${ip}`);

    if (!login || !password) {
      return NextResponse.json(
        { error: "Identifiant et mot de passe requis" },
        { status: 400 }
      );
    }

    // Auto-create admin if no users exist in database
    await ensureAdminExists();

    // Find user by login
    let user = await prisma.user.findUnique({
      where: { login },
    });

    // If user not found, try to find/reset admin account
    const adminLogin = process.env.ADMIN_LOGIN || "admin";
    if (!user && login === adminLogin) {
      console.warn(`[LOGIN] Admin user not found, attempting to create/reset...`);
      const adminPassword = process.env.ADMIN_PASSWORD || "changeme";
      const hashedPassword = await hashPassword(adminPassword);
      user = await prisma.user.upsert({
        where: { login: adminLogin },
        update: { password: hashedPassword, active: true },
        create: {
          login: adminLogin,
          name: process.env.ADMIN_NAME || "Administrateur",
          email: `${adminLogin}@localhost`,
          password: hashedPassword,
          role: "admin",
          active: true,
          permissions: JSON.stringify({
            clients: true,
            planning: true,
            utilisateurs: true,
            actions: true,
            modeles: true,
            factures: true,
            depenses: true,
            reglages: true,
            export: true,
            import: true,
          }),
        },
      });
      console.log(`[LOGIN] Admin user ${adminLogin} created/reset successfully`);
    }

    if (!user) {
      console.warn(`[LOGIN FAILED] User not found: "${login}" ip=${ip}`);
      recordFailedAttempt(ip);
      return NextResponse.json(
        { error: "Identifiant ou mot de passe incorrect" },
        { status: 401 }
      );
    }

    if (!user.active) {
      console.warn(`[LOGIN FAILED] User inactive: "${login}" (id=${user.id}), reactivating...`);
      await prisma.user.update({ where: { id: user.id }, data: { active: true } });
      user = { ...user, active: true };
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      console.warn(`[LOGIN FAILED] Password mismatch for user: "${login}" ip=${ip}`);
      recordFailedAttempt(ip);
      return NextResponse.json(
        { error: "Identifiant ou mot de passe incorrect" },
        { status: 401 }
      );
    }

    // Succès → on réinitialise le compteur
    clearFailedAttempts(ip);

    // Create JWT token
    const token = createToken({
      userId: user.id,
      login: user.login,
      role: user.role,
      name: user.name,
    });

    console.log(`[LOGIN SUCCESS] user="${login}" (id=${user.id}, role=${user.role})`);

    // Log the connection
    await prisma.action.create({
      data: {
        type: "connexion",
        detail: `Connexion au CRM`,
        userId: user.id,
      },
    });

    // Set cookie and return
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        login: user.login,
        name: user.name,
        role: user.role,
      },
    });

    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
