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
  const lowStockOnly = searchParams.get("low_stock") === "1";
  const search = searchParams.get("search");

  let query = supabase
    .from("ingredients")
    .select("*, supplier:suppliers(name)")
    .eq("active", 1)
    .order("name");
  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to fetch ingredients" }, { status: 500 });

  let flat = (data || []).map((i) => {
    const { supplier: s, ...rest } = i as typeof i & { supplier: { name: string } | null };
    return { ...rest, supplier_name: s?.name ?? null };
  });
  if (lowStockOnly) flat = flat.filter((i) => Number(i.current_stock) <= Number(i.reorder_level));

  return NextResponse.json({ ingredients: flat });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageInventory(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { name, unit, reorder_level, reorder_quantity, cost_per_unit, supplier_id, opening_stock } = await req.json();
    if (!name || !unit) return NextResponse.json({ error: "Name and unit are required" }, { status: 400 });

    const { data: ingredient, error } = await supabase
      .from("ingredients")
      .insert({
        name, unit,
        reorder_level: reorder_level || 0,
        reorder_quantity: reorder_quantity || 0,
        cost_per_unit: cost_per_unit || 0,
        supplier_id: supplier_id || null,
      })
      .select()
      .single();
    if (error) throw error;

    if (opening_stock && Number(opening_stock) > 0) {
      await supabase.from("stock_movements").insert({
        ingredient_id: ingredient.id,
        movement_type: "adjustment",
        quantity_delta: Number(opening_stock),
        reason: "Opening stock",
        staff_id: session.id,
      });
    }

    const { data: fresh } = await supabase.from("ingredients").select("*").eq("id", ingredient.id).single();
    return NextResponse.json({ success: true, ingredient: fresh }, { status: 201 });
  } catch (error) {
    console.error("Ingredient create error:", error);
    return NextResponse.json({ error: "Failed to create ingredient" }, { status: 500 });
  }
}
