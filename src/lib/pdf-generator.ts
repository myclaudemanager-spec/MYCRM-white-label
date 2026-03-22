// Générateur PDF Factures - Puppeteer
// Génère des factures PDF professionnelles à partir de templates HTML

import puppeteer from 'puppeteer';
import { Client, Invoice } from '@prisma/client';

interface InvoiceData {
  invoice: Invoice;
  client: Client;
  company: {
    name: string;
    address: string;
    phone: string;
    email: string;
    siret?: string;
    tva?: string;
  };
}

/**
 * Template HTML pour facture
 */
function getInvoiceTemplate(data: InvoiceData): string {
  const { invoice, client, company } = data;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica', 'Arial', sans-serif;
      padding: 40px;
      color: #333;
    }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid #2563eb;
    }
    .company-info h1 {
      color: #2563eb;
      font-size: 28px;
      margin-bottom: 10px;
    }
    .company-info p {
      font-size: 12px;
      line-height: 1.6;
      color: #666;
    }
    .invoice-info {
      text-align: right;
    }
    .invoice-info h2 {
      color: #2563eb;
      font-size: 32px;
      margin-bottom: 10px;
    }
    .invoice-info p {
      font-size: 14px;
      margin: 5px 0;
    }
    .invoice-number {
      font-weight: bold;
      color: #2563eb;
    }
    .parties {
      display: flex;
      justify-content: space-between;
      margin: 40px 0;
    }
    .party {
      width: 45%;
    }
    .party h3 {
      background: #f3f4f6;
      padding: 10px;
      margin-bottom: 10px;
      font-size: 14px;
      color: #2563eb;
    }
    .party p {
      font-size: 13px;
      line-height: 1.8;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 40px 0;
    }
    .items-table thead {
      background: #2563eb;
      color: white;
    }
    .items-table th {
      padding: 12px;
      text-align: left;
      font-size: 14px;
    }
    .items-table td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 13px;
    }
    .items-table tbody tr:hover {
      background: #f9fafb;
    }
    .text-right { text-align: right; }
    .totals {
      margin-left: auto;
      width: 350px;
      margin-top: 30px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      font-size: 14px;
    }
    .totals-row.total {
      background: #2563eb;
      color: white;
      padding: 15px;
      margin-top: 10px;
      font-size: 18px;
      font-weight: bold;
    }
    .footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 11px;
      color: #666;
      text-align: center;
    }
    .payment-info {
      background: #fef3c7;
      padding: 15px;
      margin: 30px 0;
      border-left: 4px solid #f59e0b;
    }
    .payment-info h4 {
      color: #92400e;
      margin-bottom: 8px;
    }
    .payment-info p {
      font-size: 12px;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-info">
      <h1>☀️ ${company.name}</h1>
      <p>${company.address}</p>
      <p>Tél: ${company.phone} | Email: ${company.email}</p>
      ${company.siret ? `<p>SIRET: ${company.siret}</p>` : ''}
      ${company.tva ? `<p>N° TVA: ${company.tva}</p>` : ''}
    </div>
    <div class="invoice-info">
      <h2>FACTURE</h2>
      <p class="invoice-number">N° ${invoice.number}</p>
      <p>Date: ${new Date(invoice.createdAt).toLocaleDateString('fr-FR')}</p>
      ${invoice.type ? `<p>Type: ${invoice.type}</p>` : ''}
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <h3>CLIENT</h3>
      <p><strong>${client.firstName} ${client.lastName}</strong></p>
      ${client.address ? `<p>${client.address}</p>` : ''}
      ${client.zipCode || client.city ? `<p>${client.zipCode || ''} ${client.city || ''}</p>` : ''}
      ${client.email ? `<p>Email: ${client.email}</p>` : ''}
      ${client.mobile || client.phone1 ? `<p>Tél: ${client.mobile || client.phone1}</p>` : ''}
    </div>
    <div class="party">
      <h3>INFORMATIONS</h3>
      <p>Date facture: ${new Date(invoice.createdAt).toLocaleDateString('fr-FR')}</p>
      <p>Statut: <strong>${invoice.status || 'EN ATTENTE'}</strong></p>
      ${invoice.bankTransId ? `<p>Réf. bancaire: ${invoice.bankTransId}</p>` : ''}
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th>Description</th>
        <th class="text-right">Quantité</th>
        <th class="text-right">Prix Unitaire</th>
        <th class="text-right">Total HT</th>
      </tr>
    </thead>
    <tbody>
      ${invoice.content ? JSON.parse(invoice.content).map((item: any) => `
        <tr>
          <td>${item.description}</td>
          <td class="text-right">${item.quantity || 1}</td>
          <td class="text-right">${(item.price || 0).toFixed(2)} AED</td>
          <td class="text-right">${((item.price || 0) * (item.quantity || 1)).toFixed(2)} AED</td>
        </tr>
      `).join('') : `
        <tr>
          <td>Installation panneaux solaires</td>
          <td class="text-right">1</td>
          <td class="text-right">${(invoice.amount || 0).toFixed(2)} AED</td>
          <td class="text-right">${(invoice.amount || 0).toFixed(2)} AED</td>
        </tr>
      `}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row">
      <span>Sous-total HT</span>
      <span>${(invoice.amount || 0).toFixed(2)} AED</span>
    </div>
    <div class="totals-row">
      <span>TVA (5%)</span>
      <span>${((invoice.amount || 0) * 0.05).toFixed(2)} AED</span>
    </div>
    <div class="totals-row total">
      <span>TOTAL TTC</span>
      <span>${((invoice.amount || 0) * 1.05).toFixed(2)} AED</span>
    </div>
  </div>

  <div class="payment-info">
    <h4>💳 MODALITÉS DE PAIEMENT</h4>
    <p>Paiement à réception de facture</p>
    <p>Virement bancaire | Chèque | Espèces</p>
    ${invoice.bankTransId ? `<p>Référence: ${invoice.bankTransId}</p>` : ''}
  </div>

  <div class="footer">
    <p>${company.name} - ${company.address}</p>
    <p>Tél: ${company.phone} | Email: ${company.email}</p>
    ${company.siret ? `<p>SIRET: ${company.siret} ${company.tva ? `| TVA: ${company.tva}` : ''}</p>` : ''}
  </div>
</body>
</html>
  `;
}

/**
 * Générer PDF facture
 */
export async function generateInvoicePDF(
  invoiceData: InvoiceData,
  outputPath: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  let browser;

  try {
    console.log(`📄 Génération PDF facture ${invoiceData.invoice.number}...`);

    // Générer HTML
    const html = getInvoiceTemplate(invoiceData);

    // Lancer Puppeteer
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Charger HTML
    await page.setContent(html, {
      waitUntil: 'networkidle0',
    });

    // Générer PDF
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px',
      },
    });

    await browser.close();

    console.log(`✅ PDF généré: ${outputPath}`);

    return {
      success: true,
      path: outputPath,
    };
  } catch (error: any) {
    console.error('❌ Erreur génération PDF:', error.message);

    if (browser) {
      await browser.close();
    }

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Données entreprise par défaut
 */
export const DEFAULT_COMPANY_INFO = {
  name: 'Energie Solaire France',
  address: 'Dubai, UAE',
  phone: '+971 XX XXX XXXX',
  email: 'contact@energiesolairefrance.fr',
  siret: undefined,
  tva: undefined,
};
