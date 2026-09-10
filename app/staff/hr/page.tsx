import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import HrView from "@/components/staff/HrView";

export default async function HrPage() {
  const session = await getSession();
  if (!session || !canAccess(session.role, "hr")) {
    redirect("/staff");
  }
  return <HrView />;
}
