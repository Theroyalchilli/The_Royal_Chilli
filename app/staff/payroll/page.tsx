import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import PayrollView from "@/components/staff/PayrollView";

// Payroll now lives under HR Management (same permission). The route stays so
// existing links/bookmarks work; PayrollView links back to /staff/hr.
export default async function PayrollPage() {
  const session = await getSession();
  if (!session || !canAccess(session.role, "hr")) {
    redirect("/staff");
  }
  return <PayrollView />;
}
