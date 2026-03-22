import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AppShell from "@/components/layout/AppShell";
import FacebookAdsContent from "./FacebookAdsContent";
import AnalyticsTabs from "@/app/analytics/AnalyticsTabs";

export default async function FacebookAdsPage() {
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
      title="Analytics Facebook Ads"
      userName={user.name}
      userRole={user.role}
    >
      <AnalyticsTabs />
      <FacebookAdsContent />
    </AppShell>
  );
}
