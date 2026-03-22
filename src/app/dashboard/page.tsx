import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AppShell from "@/components/layout/AppShell";
import DashboardContent from "./DashboardContent";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppShell title="Dashboard" userName={user.name} userRole={user.role}>
      <DashboardContent userRole={user.role} />
    </AppShell>
  );
}
