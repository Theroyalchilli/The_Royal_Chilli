import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getCustomerSessionFromRequest } from "@/lib/customer-auth";

// Cancels the customer's own not-yet-redeemed voucher and refunds the
// points via the ledger (trigger applies it to customers.loyalty_points —
// never write that column directly, same rule as everywhere else in the
// loyalty system).
export async function POST(req: NextRequest) {
  try {
    const session = await getCustomerSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: redemption } = await supabase
      .from("loyalty_redemptions")
      .select("id, points_spent, customer_id, status")
      .eq("customer_id", session.id)
      .eq("status", "issued")
      .maybeSingle();
    if (!redemption) return NextResponse.json({ error: "No active voucher to cancel" }, { status: 404 });

    const { error: cancelErr } = await supabase.from("loyalty_redemptions").update({ status: "cancelled" }).eq("id", redemption.id);
    if (cancelErr) throw cancelErr;

    if (redemption.points_spent > 0) {
      await supabase.from("loyalty_transactions").insert({
        customer_id: session.id,
        points_delta: redemption.points_spent,
        reason: "redemption_cancelled",
        reference_type: "redemption",
        reference_id: redemption.id,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cancel redemption error:", error);
    return NextResponse.json({ error: "Failed to cancel voucher" }, { status: 500 });
  }
}
