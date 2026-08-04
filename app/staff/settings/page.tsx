import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canManageStaff } from "@/lib/permissions";
import SettingsView from "@/components/staff/SettingsView";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session || !canManageStaff(session.role)) {
    redirect("/staff");
  }
  return <SettingsView canEditPermissions={session.role === "owner" || session.role === "admin"} />;
}
