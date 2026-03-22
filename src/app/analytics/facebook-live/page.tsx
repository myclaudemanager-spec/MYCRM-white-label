import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AppShell from "@/components/layout/AppShell";
import DashboardContent from "./DashboardContent";
import AnalyticsTabs from "@/app/analytics/AnalyticsTabs";

export default async function FacebookLivePage() {
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
      title="Monitoring Facebook Lead Ads - Temps Réel"
      userName={user.name}
      userRole={user.role}
    >
      <AnalyticsTabs />
      <DashboardContent />
    </AppShell>
  );
}

export const metadata = {
  title: "Facebook Live Monitoring - CRM BH",
  description: "Monitoring temps réel des campagnes Facebook Lead Ads",
};
