import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateInvoicePDF, DEFAULT_COMPANY_INFO } from "@/lib/pdf-generator";
import fs from "fs";
import path from "path";

/**
 * GET /api/invoices/[id]/pdf
 * Génère et télécharge le PDF d'une facture
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Vérifier authentification
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Next.js 16: params est une Promise
    const { id } = await params;
    const invoiceId = parseInt(id);

    // Récupérer facture + client
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
    }

    if (!invoice.client) {
      return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
    }

    // Créer répertoire invoices si n'existe pas
    const invoicesDir = path.join(process.cwd(), 'public', 'invoices');
    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir, { recursive: true });
    }

    // Générer nom fichier
    const filename = `facture-${invoice.number || invoice.id}-${Date.now()}.pdf`;
    const outputPath = path.join(invoicesDir, filename);

    // Générer PDF
    const result = await generateInvoicePDF(
      {
        invoice,
        client: invoice.client,
        company: DEFAULT_COMPANY_INFO,
      },
      outputPath
    );

    if (!result.success) {
      return NextResponse.json(
        { error: "Erreur génération PDF", details: result.error },
        { status: 500 }
      );
    }

    // Lire fichier PDF
    const pdfBuffer = fs.readFileSync(outputPath);

    // Nettoyer fichier temporaire après 10 secondes
    setTimeout(() => {
      try {
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
      } catch (err) {
        console.error('Erreur suppression PDF temporaire:', err);
      }
    }, 10000);

    // Retourner PDF
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("Erreur génération PDF facture:", error);
    return NextResponse.json(
      { error: "Erreur serveur", details: error.message },
      { status: 500 }
    );
  }
}
