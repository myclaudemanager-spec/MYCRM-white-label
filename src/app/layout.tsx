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

export const metadata: Metadata = {
  title: `MyCRM - ${process.env.NEXT_PUBLIC_BUSINESS_NAME || "CRM"}`,
  description: `CRM de gestion commerciale - ${process.env.NEXT_PUBLIC_BUSINESS_NAME || "CRM"}`,
};

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
