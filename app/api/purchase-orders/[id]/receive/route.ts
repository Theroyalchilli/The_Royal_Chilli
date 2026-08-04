import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageInventory } from "@/lib/permissions";

// Marks a PO received, moves stock via stock_movements (so it's audit-tracked like everything
// else), updates each ingredient's last-known cost, and records batch expiry dates.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageInventory(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const { items } = await req.json(); // [{ item_id, received_quantity, expiry_date }]

    const { data: po, error: poErr } = await supabase.from("purchase_orders").select("*").eq("id", id).single();
    if (poErr || !po) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    if (po.status === "received") return NextResponse.json({ error: "Already received" }, { status: 400 });
    if (po.status === "cancelled") return NextResponse.json({ error: "Cannot receive a cancelled order" }, { status: 400 });

    const { data: poItems, error: itemsErr } = await supabase.from("purchase_order_items").select("*").eq("purchase_order_id", id);
    if (itemsErr) throw itemsErr;

    const overrides = new Map((items || []).map((i: { item_id: number; received_quantity?: number; expiry_date?: string }) => [i.item_id, i]));

    for (const item of poItems || []) {
      const override = overrides.get(item.id) as { received_quantity?: number; expiry_date?: string } | undefined;
      const receivedQty = override?.received_quantity ?? item.quantity;

      await supabase.from("purchase_order_items").update({
        received_quantity: receivedQty,
        expiry_date: override?.expiry_date || null,
      }).eq("id", item.id);

      await supabase.from("stock_movements").insert({
        ingredient_id: item.ingredient_id,
        movement_type: "purchase",
        quantity_delta: receivedQty,
        reference_type: "purchase_order",
        reference_id: po.id,
        reason: `Received on PO ${po.order_number}`,
        staff_id: session.id,
      });

      // Last-known cost, used for recipe costing.
      await supabase.from("ingredients").update({ cost_per_unit: item.unit_cost }).eq("id", item.ingredient_id);
    }

    const { data: updatedPo, error: updateErr } = await supabase
      .from("purchase_orders")
      .update({ status: "received", received_date: new Date().toISOString().slice(0, 10) })
      .eq("id", id)
      .select()
      .single();
    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true, purchaseOrder: updatedPo });
  } catch (error) {
    console.error("Purchase order receive error:", error);
    return NextResponse.json({ error: "Failed to receive purchase order" }, { status: 500 });
  }
}
