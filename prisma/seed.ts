import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminPassword = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { login: "ELIEMALEK" },
    update: {
      password: adminPassword,
      active: true,
    },
    create: {
      login: "ELIEMALEK",
      name: "Elie Malek",
      email: "eliemalek09@gmail.com",
      password: adminPassword,
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

  // Create telepos users
  const teleposPassword = await bcrypt.hash("telepos123", 10);
  for (const tp of [
    { login: "leopoldpiton", name: "Leopold Piton", email: "lp.psm.pro@gmail.com" },
    { login: "maureenecolman", name: "Maureene Colman", email: "maurenne.colman@gmail.com" },
  ]) {
    await prisma.user.upsert({
      where: { login: tp.login },
      update: {
        password: teleposPassword,
        active: true,
      },
      create: {
        ...tp,
        password: teleposPassword,
        role: "telepos",
        permissions: JSON.stringify({ clients: true, planning: true }),
        restrictions: JSON.stringify({ canEditOtherRDV: true, canReadOtherRDV: true }),
      },
    });
  }

  // Create commercial users
  const commercialPassword = await bcrypt.hash("commercial123", 10);
  for (const com of [
    { login: "remystrack", name: "Remy Strack", email: "remystrack13@outlook.fr" },
    { login: "corentinhoarau", name: "Corentin Hoarau", email: "corentin83500@gmail.com" },
    { login: "tylerT", name: "Tyler T", email: "tyler.davarzon@gmail.com" },
  ]) {
    await prisma.user.upsert({
      where: { login: com.login },
      update: {
        password: commercialPassword,
        active: true,
      },
      create: {
        ...com,
        password: commercialPassword,
        role: "commercial",
        permissions: JSON.stringify({ clients: true, planning: true }),
        restrictions: JSON.stringify({
          canSeeOtherRDV: true,
          canSeeRDVStatus: true,
          canSendSMS: true,
        }),
      },
    });
  }

  // Create Statuts 1 (Call)
  const statuts1 = [
    { name: "NEW", color: "#3b82f6" },
    { name: "NRP", color: "#f97316" },
    { name: "A RAPPELER", color: "#f59e0b" },
    { name: "RDV PRIS", color: "#10b981" },
    { name: "RDV A CONFIRMER", color: "#60a5fa" },
    { name: "RDV CONFIRME", color: "#22c55e" },
    { name: "CONFIRMER", color: "#3b82f6" },
    { name: "A REPLACER", color: "#6366f1" },
    { name: "PAS INTERESSE", color: "#ef4444" },
    { name: "PAS ELIGIBLE", color: "#ef4444" },
    { name: "PAS ATTRIBUE", color: "#94a3b8" },
    { name: "FAUX NUM", color: "#6366f1" },
    { name: "FAUX NUM APPARENT", color: "#6366f1" },
    { name: "INFINANÇABLE", color: "#6366f1" },
    { name: "HORS ZONE", color: "#94a3b8" },
    { name: "REINSCRIT", color: "#8b5cf6" },
    { name: "DOUBLON / HORS SECTEUR", color: "#f97316" },
    { name: "RÉTRACTATION", color: "#ef4444" },
    { name: "RDV SMS CONFIRMATION NRP 1", color: "#6366f1" },
  ];

  for (let i = 0; i < statuts1.length; i++) {
    await prisma.status.create({
      data: { type: "statut1", name: statuts1[i].name, color: statuts1[i].color, order: i },
    });
  }

  // Create Statuts 2 (Deal)
  const statuts2 = [
    { name: "PAS SIGNÉ", color: "#ef4444" },
    { name: "ANNULÉ", color: "#dc2626" },
    { name: "SIGNE", color: "#22c55e" },
    { name: "SIGNÉ COMPLET", color: "#10b981" },
    { name: "SIGNÉ INCOMPLET", color: "#059669" },
    { name: "SIGNÉ PAIEMENT COMPTANT", color: "#047857" },
    { name: "À RETRAVAILLER", color: "#f59e0b" },
    { name: "A RETRAVAILLER", color: "#f59e0b" },
    { name: "RÉTRACTATION", color: "#ef4444" },
    { name: "CQ FAIT", color: "#8b5cf6" },
    { name: "CQ NÉGATIF", color: "#dc2626" },
    { name: "VALIDATION FINANCEMENT PROJEXIO", color: "#10b981" },
    { name: "VALIDATION FINANCEMENT SOFINCO", color: "#10b981" },
    { name: "VT PROGRAMMÉ", color: "#3b82f6" },
    { name: "ENVOI EN POSE", color: "#059669" },
    { name: "POSE PROGRAMMÉ SOLARENOV", color: "#f59e0b" },
    { name: "POSÉ SOLARENOV", color: "#059669" },
    { name: "POSÉ", color: "#166534" },
    { name: "PAYÉ", color: "#15803d" },
    { name: "A TRAVAILLÉ", color: "#6366f1" },
    { name: "DÉSINSTALLÉ", color: "#6366f1" },
    { name: "PORTE CLIENT", color: "#6366f1" },
  ];

  for (let i = 0; i < statuts2.length; i++) {
    await prisma.status.create({
      data: { type: "statut2", name: statuts2[i].name, color: statuts2[i].color, order: i },
    });
  }

  // Create campaign
  await prisma.campaign.create({ data: { name: "Leads Power" } });

  // Create templates
  const templates = [
    { name: "7-NOUVEAU LEAD", type: "email_text", subject: "RDV", content: "NOUVEAU LEAD\n\nnom du client : {last_name}\nPrénom du client : {first_name}" },
    { name: "MAIL RDV PRIS", type: "email_text", subject: "MAIL RDV PRIS", content: "Bonjour {first_name},\n\nVotre rendez-vous a bien été pris." },
    { name: "RDV PRIS", type: "sms", subject: "RDV PRIS", content: "Bonjour {first_name}, votre RDV est confirmé." },
    { name: "SMS CONFIRMATION NRP 1", type: "sms", subject: "CONFIRMATION RDV NRP 1", content: "Bonjour {first_name}, nous avons essayé de vous joindre." },
    { name: "SMS CONFIRMER", type: "sms", subject: "Confirmation RDV + Documents", content: "Bonjour {first_name}, votre RDV est confirmé. Merci de préparer vos documents." },
    { name: "INSTALLATION PROGRAMMÉE", type: "email_text", subject: "Félicitations – Votre Installation photovoltaïque est programmée !", content: "Bonjour {first_name},\n\nVotre installation est programmée." },
    { name: "Envoi de photos", type: "email_text", subject: "Envoi de photos", content: "Bonjour,\n\nVeuillez trouver ci-joint les photos." },
  ];

  for (const t of templates) {
    await prisma.template.create({ data: t });
  }

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
