import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AppShell from "@/components/layout/AppShell";
import PlanningView from "./PlanningView";

export default async function PlanningPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppShell title="Planning" userName={user.name} userRole={user.role}>
      <PlanningView userRole={user.role} userId={user.id} />
    </AppShell>
  );
}
