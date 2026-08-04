import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageFinance } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageFinance(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabase
    .from("supplier_payments")
    .select("*, supplier:suppliers(name)")
    .order("paid_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 });

  const flat = (data || []).map((p) => {
    const { supplier: s, ...rest } = p as typeof p & { supplier: { name: string } | null };
    return { ...rest, supplier_name: s?.name ?? null };
  });
  return NextResponse.json({ payments: flat });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageFinance(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { supplier_id, purchase_order_id, amount, method, notes } = await req.json();
    if (!supplier_id || !amount) return NextResponse.json({ error: "supplier_id and amount are required" }, { status: 400 });

    const { data, error } = await supabase
      .from("supplier_payments")
      .insert({ supplier_id, purchase_order_id: purchase_order_id || null, amount, method: method || null, notes: notes || null, recorded_by: session.id })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, payment: data }, { status: 201 });
  } catch (error) {
    console.error("Supplier payment create error:", error);
    return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
  }
}
