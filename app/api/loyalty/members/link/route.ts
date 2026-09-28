import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { linkMemberToOrders } from "@/lib/member-link";

// POST { customer_id, order_ids } — put an existing member on this bill.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json();
  const customerId = Number(b.customer_id);
  const orderIds = Array.isArray(b.order_ids) ? b.order_ids.map(Number).filter(Boolean) : [];
  if (!customerId || orderIds.length === 0) return NextResponse.json({ error: "customer_id and order_ids are required" }, { status: 400 });

  const { data: member } = await supabase.from("customers").select("id, name, phone, email, loyalty_points").eq("id", customerId).maybeSingle();
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const linked = await linkMemberToOrders(customerId, orderIds);
  if (!linked.ok) return NextResponse.json({ error: linked.error }, { status: 409 });
  return NextResponse.json({ member });
}
