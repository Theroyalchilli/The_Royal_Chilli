import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canViewCrm, canManageCrm } from "@/lib/permissions";
import { getCustomerStats } from "@/lib/crm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(req);
  if (!session || !canViewCrm(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const { data: customer, error } = await supabase.from("customers").select("*").eq("id", id).single();
  if (error || !customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const stats = await getCustomerStats(Number(id));

  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, order_type, status, total, created_at")
    .eq("customer_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: transactions } = await supabase
    .from("loyalty_transactions")
    .select("*")
    .eq("customer_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    customer: { ...customer, ...stats, lifetime_spend: stats.lifetimeSpend, visit_count: stats.visitCount, favourite_dish: stats.favouriteDish },
    orders: orders || [],
    transactions: transactions || [],
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageCrm(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const body = await req.json();
    const editable = ["name", "email", "date_of_birth", "address", "notes", "marketing_consent"];
    const updates: Record<string, unknown> = {};
    for (const f of editable) if (f in body) updates[f] = body[f];
    if (Object.keys(updates).length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });

    const { data, error } = await supabase.from("customers").update(updates).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, customer: data });
  } catch (error) {
    console.error("Customer update error:", error);
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
  }
}
