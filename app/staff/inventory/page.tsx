import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canManageInventory, canApproveStockTakes } from "@/lib/permissions";
import InventoryView from "@/components/staff/InventoryView";

export default async function InventoryPage() {
  const session = await getSession();
  if (!session || !canManageInventory(session.role)) {
    redirect("/staff");
  }
  return <InventoryView canApproveStockTakes={canApproveStockTakes(session.role)} />;
}
