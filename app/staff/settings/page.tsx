import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import SettingsView from "@/components/staff/SettingsView";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session || !canAccess(session.role, "settings")) {
    redirect("/staff");
  }
  return <SettingsView canEditPermissions={session.role === "admin"} />;
}
