import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AppShell from "@/components/layout/AppShell";
import ReglagesView from "./ReglagesView";

export default async function ReglagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppShell title="Réglages" userName={user.name} userRole={user.role}>
      <ReglagesView userRole={user.role} />
    </AppShell>
  );
}
