import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canManageStaff } from "@/lib/permissions";
import MenuManagementView from "@/components/staff/MenuManagementView";

export default async function StaffMenuPage() {
  const session = await getSession();
  if (!session || !canManageStaff(session.role)) {
    redirect("/staff");
  }
  return <MenuManagementView />;
}
