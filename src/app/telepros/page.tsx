import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AppShell from "@/components/layout/AppShell";
import TeleprosContent from "./TeleprosContent";

export default async function TeleprosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppShell title="Télépros 🎮" userName={user.name} userRole={user.role}>
      <TeleprosContent />
    </AppShell>
  );
}
