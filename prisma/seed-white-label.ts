/**
 * Seed white-label - données vierges pour nouveau client CRM
 * Utiliser: npx prisma db seed --script seed-white-label.ts
 * Ou via CLI: npx prisma db seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminLogin = process.env.ADMIN_LOGIN || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "changeme123";
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  // Admin user configurable
  await prisma.user.upsert({
    where: { login: adminLogin },
    update: {
      password: adminPasswordHash,
      active: true,
    },
    create: {
      login: adminLogin,
      name: "Administrateur",
      email: "admin@example.com",
      password: adminPasswordHash,
      role: "admin",
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

  // Statuts 1 (Call) - placeholders génériques
  const statuts1 = [
    { name: "NOUVEAU", color: "#3b82f6" },
    { name: "A CONTACTER", color: "#f59e0b" },
    { name: "EN COURS", color: "#8b5cf6" },
    { name: "RDV PRIS", color: "#10b981" },
    { name: "RDV CONFIRME", color: "#22c55e" },
    { name: "PAS INTERESSE", color: "#ef4444" },
    { name: "HORS CRITERES", color: "#94a3b8" },
    { name: "A RELANCER", color: "#f97316" },
  ];

  for (let i = 0; i < statuts1.length; i++) {
    await prisma.status.create({
      data: { type: "statut1", name: statuts1[i].name, color: statuts1[i].color, order: i },
    });
  }

  // Statuts 2 (Deal) - placeholders génériques
  const statuts2 = [
    { name: "PROSPECTION", color: "#3b82f6" },
    { name: "QUALIFICATION", color: "#8b5cf6" },
    { name: "PROPOSITION", color: "#f59e0b" },
    { name: "NEGOCIATION", color: "#f97316" },
    { name: "GAGNE", color: "#10b981" },
    { name: "PERDU", color: "#ef4444" },
  ];

  for (let i = 0; i < statuts2.length; i++) {
    await prisma.status.create({
      data: { type: "statut2", name: statuts2[i].name, color: statuts2[i].color, order: i },
    });
  }

  // Campaign par défaut
  await prisma.campaign.upsert({
    where: { name: "Campagne par defaut" },
    update: {},
    create: { name: "Campagne par defaut" },
  });

  console.log("✅ Seed white-label terminé");
  console.log(`   Admin: ${adminLogin} / ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
