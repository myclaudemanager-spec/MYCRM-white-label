import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AppShell from "@/components/layout/AppShell";
import CampaignesContent from "./CampaignesContent";

export default async function CampaignesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Réservé aux admins uniquement
  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <AppShell
      title="Campagnes Marketing"
      userName={user.name}
      userRole={user.role}
    >
      <CampaignesContent />
    </AppShell>
  );
}

export const metadata = {
  title: "Campagnes Marketing - CRM BH",
  description: "Gestion des campagnes email et Facebook Ads",
};
