import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import AnalyticsView from "@/components/staff/AnalyticsView";

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session || !canAccess(session.role, "analytics")) {
    redirect("/staff");
  }
  return <AnalyticsView />;
}
