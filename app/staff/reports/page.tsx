import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canManageStaff } from "@/lib/permissions";
import StaffReportsView from "@/components/staff/StaffReportsView";

export default async function StaffReportsPage() {
  const session = await getSession();
  if (!session || !canManageStaff(session.role)) {
    redirect("/staff");
  }
  return <StaffReportsView />;
}
