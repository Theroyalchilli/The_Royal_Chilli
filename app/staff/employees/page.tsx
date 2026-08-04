import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canManageStaff } from "@/lib/permissions";
import EmployeesDirectory from "@/components/staff/EmployeesDirectory";

export default async function EmployeesPage() {
  const session = await getSession();
  if (!session || !canManageStaff(session.role)) {
    redirect("/staff");
  }
  return <EmployeesDirectory />;
}
