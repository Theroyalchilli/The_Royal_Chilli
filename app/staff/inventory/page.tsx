import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import InventoryView from "@/components/staff/InventoryView";

export default async function InventoryPage() {
  const session = await getSession();
  if (!session || !canAccess(session.role, "inventory")) {
    redirect("/staff");
  }
  return <InventoryView canApproveStockTakes={canAccess(session.role, "inventory")} />;
}
