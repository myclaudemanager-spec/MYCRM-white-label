import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AppShell from "@/components/layout/AppShell";
import FacturesView from "./FacturesView";

export default async function FacturesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppShell title="Factures" userName={user.name} userRole={user.role}>
      <FacturesView userRole={user.role} />
    </AppShell>
  );
}
