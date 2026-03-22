import { redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import LandingContent from "./LandingContent";

const prisma = new PrismaClient();

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function LandingPage({ params }: PageProps) {
  const { token } = await params;

  // Vérifier si token valide
  const emailSent = await prisma.emailSent.findUnique({
    where: { token },
    include: {
      campaign: true,
    },
  });

  if (!emailSent) {
    redirect("/");
  }

  // Marquer comme "ouvert" (tracking)
  if (!emailSent.opened) {
    await prisma.emailSent.update({
      where: { token },
      data: {
        opened: true,
        openedAt: new Date(),
      },
    });

    // Incrémenter compteur campagne
    await prisma.emailCampaign.update({
      where: { id: emailSent.campaignId },
      data: {
        openedCount: { increment: 1 },
      },
    });
  }

  return <LandingContent token={token} campaignName={emailSent.campaign.name} />;
}

export const metadata = {
  title: `Réduisez votre facture d'électricité - ${process.env.NEXT_PUBLIC_BUSINESS_NAME || "Solaire"}`,
  description: "Obtenez votre étude gratuite de panneaux photovoltaïques personnalisée",
};
