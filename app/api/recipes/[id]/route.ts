import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageInventory } from "@/lib/permissions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageInventory(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const { data: recipe, error } = await supabase.from("recipes").select("*, menu_item:menu_items(name, price)").eq("id", id).single();
  if (error || !recipe) return NextResponse.json({ error: "Recipe not found" }, { status: 404 });

  const { data: ingredients } = await supabase
    .from("recipe_ingredients")
    .select("*, ingredient:ingredients(name, unit, cost_per_unit)")
    .eq("recipe_id", id);

  const flatIngredients = (ingredients || []).map((ri) => {
    const { ingredient: ing, ...rest } = ri as typeof ri & { ingredient: { name: string; unit: string; cost_per_unit: number } | null };
    return { ...rest, ingredient_name: ing?.name ?? null, unit: ing?.unit ?? null, cost_per_unit: ing?.cost_per_unit ?? 0 };
  });
  const recipeCost = flatIngredients.reduce((sum, ri) => sum + Number(ri.quantity) * Number(ri.cost_per_unit), 0);

  const { menu_item: mi, ...recipeRest } = recipe as typeof recipe & { menu_item: { name: string; price: number } | null };
  const price = mi ? Number(mi.price) : null;

  return NextResponse.json({
    recipe: {
      ...recipeRest,
      menu_item_name: mi?.name ?? null,
      menu_item_price: price,
      recipe_cost: Math.round(recipeCost * 100) / 100,
      food_cost_pct: price && price > 0 ? Math.round((recipeCost / price) * 1000) / 10 : null,
    },
    ingredients: flatIngredients,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageInventory(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const { menu_item_id, name, yield_quantity, yield_unit, notes, ingredients } = await req.json();

    const updates: Record<string, unknown> = {};
    if (menu_item_id !== undefined) updates.menu_item_id = menu_item_id;
    if (name !== undefined) updates.name = name;
    if (yield_quantity !== undefined) updates.yield_quantity = yield_quantity;
    if (yield_unit !== undefined) updates.yield_unit = yield_unit;
    if (notes !== undefined) updates.notes = notes;

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from("recipes").update(updates).eq("id", id);
      if (error) throw error;
    }

    if (Array.isArray(ingredients)) {
      await supabase.from("recipe_ingredients").delete().eq("recipe_id", id);
      if (ingredients.length > 0) {
        const rows = ingredients.map((i: { ingredient_id: number; quantity: number; notes?: string }) => ({
          recipe_id: Number(id), ingredient_id: i.ingredient_id, quantity: i.quantity, notes: i.notes || null,
        }));
        const { error: riErr } = await supabase.from("recipe_ingredients").insert(rows);
        if (riErr) throw riErr;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Recipe update error:", error);
    return NextResponse.json({ error: "Failed to update recipe" }, { status: 500 });
  }
}
