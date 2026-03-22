import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AppShell from "@/components/layout/AppShell";
import ActionsLog from "./ActionsLog";

export default async function ActionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppShell title="Actions" userName={user.name} userRole={user.role}>
      <ActionsLog />
    </AppShell>
  );
}
