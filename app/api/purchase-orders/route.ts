import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageInventory } from "@/lib/permissions";

async function generatePoNumber(): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const { count } = await supabase
    .from("purchase_orders")
    .select("*", { count: "exact", head: true })
    .gte("created_at", new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  return `PO-${dateStr}-${String((count ?? 0) + 1).padStart(3, "0")}`;
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageInventory(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  let query = supabase.from("purchase_orders").select("*, supplier:suppliers(name)").order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to fetch purchase orders" }, { status: 500 });
  const flat = (data || []).map((po) => {
    const { supplier: s, ...rest } = po as typeof po & { supplier: { name: string } | null };
    return { ...rest, supplier_name: s?.name ?? null };
  });
  return NextResponse.json({ purchaseOrders: flat });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageInventory(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { supplier_id, expected_date, notes, items, status } = await req.json();
    if (!supplier_id || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "supplier_id and at least one item are required" }, { status: 400 });
    }

    const orderNumber = await generatePoNumber();
    const totalCost = items.reduce((sum: number, i: { quantity: number; unit_cost: number }) => sum + i.quantity * i.unit_cost, 0);

    const { data: po, error: poErr } = await supabase
      .from("purchase_orders")
      .insert({
        order_number: orderNumber,
        supplier_id,
        status: status === "ordered" ? "ordered" : "draft",
        expected_date: expected_date || null,
        notes: notes || null,
        total_cost: Math.round(totalCost * 100) / 100,
        created_by: session.id,
      })
      .select()
      .single();
    if (poErr) throw poErr;

    const itemRows = items.map((i: { ingredient_id: number; quantity: number; unit_cost: number }) => ({
      purchase_order_id: po.id,
      ingredient_id: i.ingredient_id,
      quantity: i.quantity,
      unit_cost: i.unit_cost,
    }));
    const { error: itemsErr } = await supabase.from("purchase_order_items").insert(itemRows);
    if (itemsErr) throw itemsErr;

    return NextResponse.json({ success: true, purchaseOrder: po }, { status: 201 });
  } catch (error) {
    console.error("Purchase order create error:", error);
    return NextResponse.json({ error: "Failed to create purchase order" }, { status: 500 });
  }
}
