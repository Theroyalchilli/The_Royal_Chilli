import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageInventory } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageInventory(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const ingredientId = searchParams.get("ingredient_id");
  const movementType = searchParams.get("movement_type");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supabase
    .from("stock_movements")
    .select("*, ingredient:ingredients(name, unit), staff:staff!stock_movements_staff_id_fkey(name)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (ingredientId) query = query.eq("ingredient_id", ingredientId);
  if (movementType) query = query.eq("movement_type", movementType);
  if (from) query = query.gte("created_at", `${from}T00:00:00.000Z`);
  if (to) query = query.lte("created_at", `${to}T23:59:59.999Z`);

  const { data, error } = await query;
  if (error) {
    console.error("Stock movements fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch stock movements" }, { status: 500 });
  }
  const flat = (data || []).map((m) => {
    const { ingredient: i, staff: s, ...rest } = m as typeof m & {
      ingredient: { name: string; unit: string } | null;
      staff: { name: string } | null;
    };
    return { ...rest, ingredient_name: i?.name ?? null, unit: i?.unit ?? null, staff_name: s?.name ?? null };
  });
  return NextResponse.json({ movements: flat });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageInventory(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { ingredient_id, movement_type, quantity, reason } = await req.json();
    if (!ingredient_id || !movement_type || !quantity) {
      return NextResponse.json({ error: "ingredient_id, movement_type and quantity are required" }, { status: 400 });
    }
    if (!["waste", "adjustment", "usage"].includes(movement_type)) {
      return NextResponse.json({ error: "This endpoint only records waste, adjustment, or usage — purchases are recorded via receiving a purchase order" }, { status: 400 });
    }

    // Waste and usage always reduce stock; a manual adjustment can go either way (client sends the signed delta).
    const delta = movement_type === "adjustment" ? Number(quantity) : -Math.abs(Number(quantity));

    const { data, error } = await supabase
      .from("stock_movements")
      .insert({ ingredient_id, movement_type, quantity_delta: delta, reason: reason || null, staff_id: session.id })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, movement: data }, { status: 201 });
  } catch (error) {
    console.error("Stock movement create error:", error);
    return NextResponse.json({ error: "Failed to record stock movement" }, { status: 500 });
  }
}
