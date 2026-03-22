import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AppShell from "@/components/layout/AppShell";
import UtilisateursView from "./UtilisateursView";

export default async function UtilisateursPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppShell title="Utilisateurs" userName={user.name} userRole={user.role}>
      <UtilisateursView userRole={user.role} currentUserId={user.id} />
    </AppShell>
  );
}
