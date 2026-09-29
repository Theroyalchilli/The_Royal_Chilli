import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { mergeRecipeLines, recipeForDish } from "@/lib/unique-entry";
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
    if (!name || !String(name).trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    // One active recipe per dish — two would make stock and food cost ambiguous.
    if (menu_item_id) {
      const taken = await recipeForDish(Number(menu_item_id));
      if (taken) return NextResponse.json({ error: `That dish already has a recipe ("${taken.name}")` }, { status: 409 });
    }

    const { data: recipe, error } = await supabase
      .from("recipes")
      .insert({ menu_item_id: menu_item_id || null, name: String(name).trim(), yield_quantity: yield_quantity || 1, yield_unit: yield_unit || "portion" })
      .select()
      .single();
    if (error) throw error;

    const rows = Array.isArray(ingredients) ? mergeRecipeLines(recipe.id, ingredients) : [];
    if (rows.length > 0) {
      const { error: riErr } = await supabase.from("recipe_ingredients").insert(rows);
      if (riErr) throw riErr;
    }

    return NextResponse.json({ success: true, recipe }, { status: 201 });
  } catch (error) {
    console.error("Recipe create error:", error);
    return NextResponse.json({ error: "Failed to create recipe" }, { status: 500 });
  }
}
