import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AppShell from "@/components/layout/AppShell";
import ClientsPage from "./ClientsPage";

export default async function Clients() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppShell title="Clients" userName={user.name} userRole={user.role}>
      <ClientsPage userId={user.id} userRole={user.role} />
    </AppShell>
  );
}
