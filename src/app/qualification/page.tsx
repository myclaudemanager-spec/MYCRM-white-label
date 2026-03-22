import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AppShell from "@/components/layout/AppShell";
import QualificationDashboard from "./QualificationDashboard";

export default async function QualificationPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <AppShell title="Qualification" userName={user.name} userRole={user.role}>
      <QualificationDashboard userId={user.id} userRole={user.role} />
    </AppShell>
  );
}
