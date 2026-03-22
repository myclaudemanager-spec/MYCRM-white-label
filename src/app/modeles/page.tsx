import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AppShell from "@/components/layout/AppShell";
import ModelesView from "./ModelesView";

export default async function ModelesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppShell title="Modèles" userName={user.name} userRole={user.role}>
      <ModelesView userRole={user.role} />
    </AppShell>
  );
}
