import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import FinanceView from "@/components/staff/FinanceView";

export default async function FinancePage() {
  const session = await getSession();
  if (!session || !canAccess(session.role, "finance")) {
    redirect("/staff");
  }
  return <FinanceView />;
}
