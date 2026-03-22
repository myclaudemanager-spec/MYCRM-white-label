import AnalyticsTabs from "@/app/analytics/AnalyticsTabs";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AppShell from "@/components/layout/AppShell";
import DashboardOverview from "./DashboardOverview";

export default async function AnalyticsOverviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  return (
    <AppShell title="Analytics" userName={user.name} userRole={user.role}>
      <AnalyticsTabs />
      <DashboardOverview />
    </AppShell>
  );
}
