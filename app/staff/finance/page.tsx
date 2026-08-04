import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canManageFinance } from "@/lib/permissions";
import FinanceView from "@/components/staff/FinanceView";

export default async function FinancePage() {
  const session = await getSession();
  if (!session || !canManageFinance(session.role)) {
    redirect("/staff");
  }
  return <FinanceView />;
}
