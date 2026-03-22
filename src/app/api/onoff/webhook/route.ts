import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { addHistoryEntry, createCallHistoryEntry } from "@/lib/history";

function normalizePhone(phone: string): string[] {
  const clean = phone.replace(/[\s.\-+()']/g, "");
  const variants: string[] = [clean];
  if (clean.startsWith("33") && clean.length === 11) variants.push("0" + clean.slice(2));
  if (clean.startsWith("0033") && clean.length === 13) variants.push("0" + clean.slice(4));
  return [...new Set(variants)];
}

function mapStatus(callStatus: string): string {
  switch (callStatus) {
    case "ANSWERED":     return "APPEL_ONOFF";
    case "MISSED_CALL":  return "NRP";
    case "BUSY":         return "NRP";
    case "WRONG_NUMBER": return "FAUX NUMERO";
    case "VMS":          return "NRP";
    default:             return "NRP";
  }
}

export async function POST(req: Request) {
  try {
    // 1. Valider la clé webhook
    const apiKey = req.headers.get("x-api-key");
    if (!process.env.ONOFF_WEBHOOK_SECRET || apiKey !== process.env.ONOFF_WEBHOOK_SECRET) {
      console.warn("OnOff webhook: clé invalide", apiKey);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      id: onoffEventId,
      eventName,
      onoffUserEmail,
      onoffUserName,
      externalNumber,
      callStarted,
      callDuration,
      callDirection,
      callStatus,
      callNotes,
    } = body;

    console.log("OnOff webhook reçu:", { eventName, callStatus, callDirection, externalNumber, onoffUserEmail });

    // 2. Ignorer les RECORDING (doublon du CDR)
    if (eventName === "RECORDING") return NextResponse.json({});

    // 3. Idempotence — éviter les doublons
    const idTag = `[onoff:${onoffEventId}]`;
    const existing = await prisma.callLog.findFirst({ where: { comment: { startsWith: idTag } } });
    if (existing) return NextResponse.json({});

    // 4. Trouver l'utilisateur télépro par email
    let userId: number | null = null;
    let userName = onoffUserName || "OnOff";
    if (onoffUserEmail) {
      const u = await prisma.user.findFirst({ where: { email: onoffUserEmail }, select: { id: true, name: true } });
      if (u) { userId = u.id; userName = u.name; }
    }
    // Fallback : premier admin
    if (!userId) {
      const admin = await prisma.user.findFirst({ where: { role: "admin", active: true }, select: { id: true } });
      if (admin) userId = admin.id;
    }
    if (!userId) return NextResponse.json({});

    // 5. Trouver le client par numéro de téléphone
    let clientId: number | null = null;
    let clientHistory: string | null = null;
    if (externalNumber) {
      const variants = normalizePhone(externalNumber);
      const orClauses = variants.flatMap(p => [{ mobile: p }, { phone1: p }]);
      const client = await prisma.client.findFirst({ where: { OR: orClauses }, select: { id: true, callHistory: true } });
      if (client) { clientId = client.id; clientHistory = client.callHistory; }
    }
    if (!clientId) {
      console.log("OnOff webhook: client non trouvé pour", externalNumber);
      return NextResponse.json({});
    }

    // 6. Résultat + heure
    const result = mapStatus(callStatus);
    const callTime = callStarted
      ? new Date(callStarted).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })
      : new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
    const comment = callNotes ? `${idTag} ${callNotes}` : idTag;

    // 7. Créer le log d'appel
    await prisma.callLog.create({
      data: { clientId, userId, result, comment, duration: callDuration || 0, callTime },
    });

    // 8. Mettre à jour l'historique client
    const historyEntry = createCallHistoryEntry(userName, result, callNotes || null, callTime);
    const updateData: Record<string, unknown> = {
      callHistory: addHistoryEntry(clientHistory, historyEntry),
    };
    if (result === "NRP") {
      updateData.missedCalls = { increment: 1 };
      updateData.statusCall = "NRP";
    }
    if (result === "FAUX NUMERO") updateData.statusCall = "FAUX NUMERO";

    await prisma.client.update({ where: { id: clientId }, data: updateData });

    console.log(`OnOff webhook: appel logué — client ${clientId}, résultat ${result}`);
    return NextResponse.json({});
  } catch (err) {
    console.error("OnOff webhook error:", err);
    return NextResponse.json({}); // Toujours 200 pour éviter les retentatives
  }
}
