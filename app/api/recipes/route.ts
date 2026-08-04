import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageInventory } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageInventory(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: recipes, error } = await supabase
    .from("recipes")
    .select("*, menu_item:menu_items(name, price)")
    .eq("active", 1)
    .order("name");
  if (error) return NextResponse.json({ error: "Failed to fetch recipes" }, { status: 500 });

  const { data: allIngredients } = await supabase
    .from("recipe_ingredients")
    .select("recipe_id, quantity, ingredient:ingredients(cost_per_unit)");

  const costByRecipe = new Map<number, number>();
  for (const ri of allIngredients || []) {
    const ing = ri.ingredient as unknown as { cost_per_unit: number } | null;
    const cost = Number(ri.quantity) * Number(ing?.cost_per_unit ?? 0);
    costByRecipe.set(ri.recipe_id, (costByRecipe.get(ri.recipe_id) || 0) + cost);
  }

  const flat = (recipes || []).map((r) => {
    const { menu_item: mi, ...rest } = r as typeof r & { menu_item: { name: string; price: number } | null };
    const recipeCost = Math.round((costByRecipe.get(r.id) || 0) * 100) / 100;
    const price = mi ? Number(mi.price) : null;
    return {
      ...rest,
      menu_item_name: mi?.name ?? null,
      menu_item_price: price,
      recipe_cost: recipeCost,
      food_cost_pct: price && price > 0 ? Math.round((recipeCost / price) * 1000) / 10 : null,
    };
  });

  return NextResponse.json({ recipes: flat });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageInventory(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { menu_item_id, name, yield_quantity, yield_unit, ingredients } = await req.json();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const { data: recipe, error } = await supabase
      .from("recipes")
      .insert({ menu_item_id: menu_item_id || null, name, yield_quantity: yield_quantity || 1, yield_unit: yield_unit || "portion" })
      .select()
      .single();
    if (error) throw error;

    if (Array.isArray(ingredients) && ingredients.length > 0) {
      const rows = ingredients.map((i: { ingredient_id: number; quantity: number; notes?: string }) => ({
        recipe_id: recipe.id, ingredient_id: i.ingredient_id, quantity: i.quantity, notes: i.notes || null,
      }));
      const { error: riErr } = await supabase.from("recipe_ingredients").insert(rows);
      if (riErr) throw riErr;
    }

    return NextResponse.json({ success: true, recipe }, { status: 201 });
  } catch (error) {
    console.error("Recipe create error:", error);
    return NextResponse.json({ error: "Failed to create recipe" }, { status: 500 });
  }
}
