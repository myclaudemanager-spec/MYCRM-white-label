/**
 * 📧 API EMAIL CAMPAIGNS LANDING
 *
 * Capture les leads depuis landing pages email campaigns (avec token tracking).
 * REFACTORÉ pour utiliser LeadIngestionService.
 *
 * Spécificités :
 * - Validation token unique par email
 * - Tracking clics et conversions
 * - Incrémentation compteurs campagne
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { leadIngestionService, LeadSource } from "@/lib/lead-ingestion-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, ...formData } = body;

    console.log(`[EmailCampaign] ${new Date().toISOString()} - Lead capture reçu`);

    // 1. Validation token
    if (!token) {
      return NextResponse.json({ error: "Token manquant" }, { status: 400 });
    }

    // 2. Vérifier token valide
    const emailSent = await prisma.emailSent.findUnique({
      where: { token },
      include: { campaign: true },
    });

    if (!emailSent) {
      console.log(`[EmailCampaign] ❌ Token invalide: ${token}`);
      return NextResponse.json({ error: "Token invalide" }, { status: 404 });
    }

    if (emailSent.converted) {
      console.log(`[EmailCampaign] ⚠️  Lead déjà capturé pour token: ${token}`);
      return NextResponse.json(
        { error: "Lead déjà capturé" },
        { status: 400 }
      );
    }

    // 3. Marquer email comme "cliqué" (si pas encore fait)
    if (!emailSent.clicked) {
      await prisma.emailSent.update({
        where: { token },
        data: {
          clicked: true,
          clickedAt: new Date(),
        },
      });

      // Incrémenter compteur clics campagne
      await prisma.emailCampaign.update({
        where: { id: emailSent.campaignId },
        data: {
          clickedCount: { increment: 1 },
        },
      });

      console.log(`[EmailCampaign] 📊 Email marqué comme cliqué (campagne ${emailSent.campaignId})`);
    }

    // 4. 🎯 DÉLÉGUER au service central d'ingestion
    const result = await leadIngestionService.ingest(LeadSource.EMAIL_CAMPAIGN, {
      civilite: formData.civilite,
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      mobile: formData.mobile,
      city: formData.city,
      zipCode: formData.zipCode,
      electricBill: formData.electricBill,
      isOwner: formData.isOwner,
      propertyType: formData.propertyType,
      sourceMetadata: {
        emailToken: token,
        campaignId: emailSent.campaignId,
        campaignName: emailSent.campaign.name,
        emailAddress: emailSent.email,
        capturedAt: new Date().toISOString(),
      }
    });

    if (!result.success) {
      console.log(`[EmailCampaign] ⚠️  Lead rejeté - Status: ${result.status} - ${result.error}`);

      return NextResponse.json({
        error: "Lead rejeté",
        reason: result.error,
        status: result.status,
      }, { status: 422 });
    }

    console.log(`[EmailCampaign] ✅ Lead créé avec succès - Client ID: ${result.client.id}`);

    // 5. Marquer email comme "converti" et lier au client
    await prisma.emailSent.update({
      where: { token },
      data: {
        converted: true,
        convertedAt: new Date(),
        clientId: result.client.id,
        capturedData: JSON.stringify(formData),
      },
    });

    // 6. Incrémenter compteur leads campagne
    await prisma.emailCampaign.update({
      where: { id: emailSent.campaignId },
      data: {
        leadsCount: { increment: 1 },
      },
    });

    console.log(`[EmailCampaign] 📈 Compteurs campagne ${emailSent.campaignId} mis à jour`);

    return NextResponse.json({
      success: true,
      clientId: result.client.id,
      message: "Lead capturé et qualifié avec succès",
    });

  } catch (error) {
    console.error("[EmailCampaign] ❌ Erreur:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
