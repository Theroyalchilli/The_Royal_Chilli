import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import MenuManagementView from "@/components/staff/MenuManagementView";

export default async function StaffMenuPage() {
  const session = await getSession();
  if (!session || !canAccess(session.role, "menu")) {
    redirect("/staff");
  }
  return <MenuManagementView />;
}
