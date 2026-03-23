import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { FacebookPixelScript } from "@/components/layout/FacebookPixel";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1d4ed8",
};

export function generateMetadata(): Metadata {
  const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "CRM";
  const baseUrl = process.env.CRM_BASE_URL || "https://mycrm.solar";

  return {
    title: `MyCRM - ${businessName}`,
    description: `CRM de gestion commerciale - ${businessName}`,
    alternates: {
      canonical: baseUrl,
    },
    openGraph: {
      title: `MyCRM - ${businessName}`,
      description: `CRM de gestion commerciale - ${businessName}`,
      url: baseUrl,
      siteName: businessName,
      locale: "fr_FR",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `MyCRM - ${businessName}`,
      description: `CRM de gestion commerciale - ${businessName}`,
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <FacebookPixelScript />
        {children}
      </body>
    </html>
  );
}
