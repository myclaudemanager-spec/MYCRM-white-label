import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { calculateLeadScore } from "@/lib/lead-scoring";

const COLUMN_MAP: Record<string, string> = {
  // Prénom
  prenom: "firstName", firstname: "firstName", first_name: "firstName", "first name": "firstName",
  // Nom
  nom: "lastName", lastname: "lastName", last_name: "lastName", "last name": "lastName", name: "lastName", "nom de famille": "lastName",
  // Mobile
  mobile: "mobile", tel: "mobile", telephone: "mobile", phone: "mobile",
  portable: "mobile", gsm: "mobile", tel_mobile: "mobile", telephone_mobile: "mobile",
  "tel mobile": "mobile", "telephone mobile": "mobile", "num tel": "mobile", "numero tel": "mobile",
  "numero de telephone": "mobile", "n de telephone": "mobile", "n telephone": "mobile",
  // Fixe
  phone1: "phone1", fixe: "phone1", telephone_fixe: "phone1", tel2: "phone1", telephone2: "phone1",
  "tel fixe": "phone1", "telephone fixe": "phone1",
  // Email
  email: "email", mail: "email", courriel: "email", "adresse mail": "email", "adresse email": "email",
  // Adresse
  adresse: "address", address: "address", rue: "address", "adresse postale": "address",
  // Code postal / Département
  code_postal: "zipCode", codepostal: "zipCode", zip: "zipCode",
  cp: "zipCode", postal: "zipCode", "code postal": "zipCode",
  departement: "zipCode", department: "zipCode", dept: "zipCode", dep: "zipCode", "code dep": "zipCode",
  // Ville
  ville: "city", city: "city", commune: "city",
  // Campagne / Source
  campagne: "campaign", campaign: "campaign", source: "campaign", origine: "campaign",
  // Civilité
  civilite: "civilite", genre: "civilite", sexe: "civilite",
  // Observation
  observation: "observation", notes: "observation", commentaire: "observation", remarque: "observation",
};

function detectSeparator(line: string): string {
  const counts: Record<string, number> = { ";": 0, ",": 0, "\t": 0, "|": 0 };
  for (const ch of line) if (ch in counts) counts[ch]++;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function parseCsvLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === sep && !inQuotes) {
      result.push(current.trim()); current = "";
    } else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const campaignOverride = (formData.get("campaign") as string) || "";
    const teleposIdStr = (formData.get("teleposId") as string) || "";
    if (!file) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });

    // Lire le buffer brut pour gérer UTF-8 ET Windows-1252 (Excel FR)
    const buffer = Buffer.from(await file.arrayBuffer());
    let rawText = buffer.toString("utf-8");
    // Si des caractères "replacement" sont présents → fichier Windows-1252
    if (rawText.includes("\uFFFD")) {
      rawText = buffer.toString("latin1");
    }
    // Supprimer le BOM UTF-8 (fréquent dans les CSV exportés depuis Excel)
    const text = rawText.replace(/^\uFEFF/, "");
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return NextResponse.json({ error: "Fichier vide" }, { status: 400 });

    const sep = detectSeparator(lines[0]);
    const rawHeaders = parseCsvLine(lines[0], sep);

    function normalizeHeader(h: string): string {
      return h
        .toLowerCase()
        .replace(/^\uFEFF/, "")   // BOM résiduel par sécurité
        .replace(/[éèê]/g, "e")
        .replace(/[àâ]/g, "a")
        .replace(/[ôó]/g, "o")
        .replace(/[îï]/g, "i")
        .replace(/[ùûü]/g, "u")
        .replace(/ç/g, "c")
        .replace(/ñ/g, "n")
        .replace(/['"°#]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    const headers = rawHeaders.map(h => normalizeHeader(h));

    const fieldMap: Record<number, string> = {};
    headers.forEach((h, i) => { if (COLUMN_MAP[h]) fieldMap[i] = COLUMN_MAP[h]; });

    // Sécurité : si aucune colonne reconnue, retourner une erreur claire
    if (Object.keys(fieldMap).length === 0) {
      return NextResponse.json({
        error: "Aucune colonne reconnue dans le CSV. Vérifiez les en-têtes.",
        detectedHeaders: rawHeaders,
        hint: "Colonnes attendues : Prénom, Nom, Mobile, Email, Ville, Code postal...",
      }, { status: 400 });
    }

    let imported = 0, skipped = 0, errors = 0;
    const errorDetails: string[] = [];
    const importedIds: number[] = [];
    const skippedDetails: { id: number; firstName: string | null; lastName: string | null; mobile: string | null; email: string | null; statusCall: string | null; campaign: string | null }[] = [];

    // Pre-fetch max clientNumber once (avoid N+1 query)
    const maxNumResult = await prisma.client.aggregate({ _max: { clientNumber: true } });
    let nextClientNumber = (maxNumResult._max.clientNumber ?? 0) + 1;

    for (let rowIdx = 1; rowIdx < lines.length; rowIdx++) {
      const values = parseCsvLine(lines[rowIdx], sep);
      if (values.every(v => !v.trim())) continue;

      const data: Record<string, string | null> = {};
      Object.entries(fieldMap).forEach(([col, field]) => {
        const val = values[parseInt(col)]?.trim() || null;
        if (val) data[field] = val;
      });

      // Campagne : priorité au champ saisi manuellement, sinon colonne CSV, sinon défaut
      data.campaign = campaignOverride || data.campaign || "Import CSV";

      // Normaliser le mobile
      if (data.mobile) {
        data.mobile = data.mobile.replace(/[\s.\-()]/g, "");
        if (data.mobile.startsWith("+33")) data.mobile = "0" + data.mobile.slice(3);
        else if (data.mobile.startsWith("33") && data.mobile.length === 11) data.mobile = "0" + data.mobile.slice(2);
      }

      // Dédoublonnage sur mobile + email
      if (data.mobile || data.email) {
        const orClauses: object[] = [];
        if (data.mobile) orClauses.push({ mobile: data.mobile });
        if (data.email) orClauses.push({ email: data.email });
        const existing = await prisma.client.findFirst({
          where: { OR: orClauses },
          select: { id: true, firstName: true, lastName: true, mobile: true, email: true, statusCall: true, campaign: true },
        });
        if (existing) {
          skipped++;
          skippedDetails.push({
            id: existing.id,
            firstName: existing.firstName,
            lastName: existing.lastName,
            mobile: existing.mobile,
            email: existing.email,
            statusCall: existing.statusCall,
            campaign: existing.campaign,
          });
          continue;
        }
      }

      try {
        const createData: any = { ...data, statusCall: "NEW", clientNumber: nextClientNumber++, isOwner: "Oui" };
        if (teleposIdStr) createData.teleposId = parseInt(teleposIdStr);
        const created = await prisma.client.create({
          data: createData,
        });

        // Auto-calcul du score
        const score = calculateLeadScore(created);
        await prisma.client.update({
          where: { id: created.id },
          data: {
            leadScore: score.total,
            leadPriority: score.priority,
            leadScoreDetails: JSON.stringify(score.details),
            leadScoreUpdatedAt: new Date(),
          },
        });

        imported++;
        importedIds.push(created.id);
      } catch (e: any) {
        errors++;
        if (errorDetails.length < 5) errorDetails.push(`Ligne ${rowIdx + 1}: ${e.message}`);
      }
    }

    // ── Notifications ──────────────────────────────────────────────────────────
    if (imported > 0) {
      const campaignLabel = campaignOverride || "Import CSV";

      // Notifier tous les admins et managers
      const admins = await prisma.user.findMany({
        where: { role: { in: ["admin", "manager"] }, active: true },
        select: { id: true },
      });

      if (admins.length > 0) {
        // 1 notification résumé par admin/manager
        await prisma.notification.createMany({
          data: admins.map(a => ({
            userId: a.id,
            type: "csv_import",
            title: `📥 ${imported} nouveau${imported > 1 ? "x" : ""} lead${imported > 1 ? "s" : ""} importé${imported > 1 ? "s" : ""}`,
            message: `${imported} lead${imported > 1 ? "s" : ""} importé${imported > 1 ? "s" : ""} depuis « ${campaignLabel} »${skipped > 0 ? ` (${skipped} doublon${skipped > 1 ? "s" : ""} ignoré${skipped > 1 ? "s" : ""})` : ""}.`,
            clientId: importedIds[0] ?? null, // lien vers le premier lead importé
          })),
        });
      }
    }
    // ──────────────────────────────────────────────────────────────────────────

    return NextResponse.json({ imported, skipped, errors, errorDetails, skippedDetails, total: lines.length - 1 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
