import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";

// A refund is just another row in `payments`, with a negative amount — same
// pattern as a normal payment, so the existing trigger that keeps
// orders.amount_paid in sync handles it for free. Deliberately never touches
// orders.status: even a partially-refunded order stays `paid` — it's a
// financial correction, often happening long after the customer's left, and
// reverting status could wrongly re-trigger table/kitchen-facing logic.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { amount, method, reason } = await req.json().catch(() => ({}));

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: "Refund amount is required" }, { status: 400 });
    }
    if (!method || !["cash", "card", "card_online"].includes(method)) {
      return NextResponse.json({ error: "A valid refund method is required" }, { status: 400 });
    }
    if (!reason || !String(reason).trim()) {
      return NextResponse.json({ error: "A reason is required" }, { status: 400 });
    }

    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, amount_paid")
      .eq("id", id)
      .single();
    if (fetchError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const refundAmount = Math.round(Number(amount) * 100) / 100;
    if (refundAmount > Number(order.amount_paid) + 0.01) {
      return NextResponse.json(
        { error: `Cannot refund more than the £${Number(order.amount_paid).toFixed(2)} paid` },
        { status: 400 }
      );
    }

    const { error: insertError } = await supabase.from("payments").insert({
      order_id: Number(id),
      method,
      amount: -refundAmount,
      staff_id: session.id,
      reference: `Refund: ${String(reason).trim()}`,
    });
    if (insertError) throw insertError;

    const { data: refreshed } = await supabase.from("orders").select("total, amount_paid").eq("id", id).single();

    return NextResponse.json({ success: true, amount_paid: refreshed?.amount_paid ?? null });
  } catch (error) {
    console.error("Refund error:", error);
    return NextResponse.json({ error: "Failed to process refund" }, { status: 500 });
  }
}
