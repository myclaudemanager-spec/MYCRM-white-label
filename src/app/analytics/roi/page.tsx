import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AppShell from "@/components/layout/AppShell";
import ROIContent from "./ROIContent";
import AnalyticsTabs from "@/app/analytics/AnalyticsTabs";

export default async function ROIPage() {
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
      title="ROI Facebook Ads"
      userName={user.name}
      userRole={user.role}
    >
      <AnalyticsTabs />
      <ROIContent />
    </AppShell>
  );
}

export const metadata = {
  title: "ROI Facebook Ads - CRM BH",
  description: "Analyse du retour sur investissement des campagnes Facebook Ads",
};
