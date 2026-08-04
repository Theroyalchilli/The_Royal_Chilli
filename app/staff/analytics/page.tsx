import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canManageStaff } from "@/lib/permissions";
import AnalyticsView from "@/components/staff/AnalyticsView";

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session || !canManageStaff(session.role)) {
    redirect("/staff");
  }
  return <AnalyticsView />;
}
