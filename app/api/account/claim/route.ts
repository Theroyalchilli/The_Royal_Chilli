import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getCustomerSessionFromRequest } from "@/lib/customer-auth";
import { claimableOrder } from "@/lib/claim";
import { awardPurchasePoints } from "@/lib/customers";
import { customerBusinessId } from "@/lib/crm";

// POST { o, k } — the signed-in customer claims a receipt's points.
export async function POST(req: NextRequest) {
  const session = await getCustomerSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Please log in first" }, { status: 401 });

  const { o, k } = await req.json().catch(() => ({}));
  const check = await claimableOrder(Number(o), String(k || ""));
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  // Points go to an account at the business the bill is from.
  const { data: own } = await supabase.from("orders").select("business_id").eq("id", check.order.id).single();
  if (!own || own.business_id !== (await customerBusinessId(session.id))) {
    return NextResponse.json({ error: "This receipt is from a different restaurant — log in on that restaurant's website to claim it." }, { status: 400 });
  }

  // One claim per receipt: only succeeds while no member is on the bill.
  const { data: linked } = await supabase
    .from("orders")
    .update({ customer_id: session.id, updated_at: new Date().toISOString() })
    .eq("id", check.order.id)
    .is("customer_id", null)
    .select("id");
  if (!linked || linked.length === 0) {
    return NextResponse.json({ error: "The points for this bill have already been claimed." }, { status: 409 });
  }

  await awardPurchasePoints(session.id, check.order.total, check.order.id, check.order.paidAt);
  const { data: c } = await supabase.from("customers").select("loyalty_points").eq("id", session.id).single();
  return NextResponse.json({ success: true, points: check.order.points, balance: c?.loyalty_points ?? null });
}
