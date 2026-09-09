import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canManageStaff } from "@/lib/permissions";
import TableManagementView from "@/components/staff/TableManagementView";

export default async function StaffTablesPage() {
  const session = await getSession();
  if (!session || !canManageStaff(session.role)) {
    redirect("/staff");
  }
  return <TableManagementView />;
}
