import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AppShell from "@/components/layout/AppShell";
import DepensesView from "./DepensesView";

export default async function DepensesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppShell title="Dépenses" userName={user.name} userRole={user.role}>
      <DepensesView userRole={user.role} />
    </AppShell>
  );
}
