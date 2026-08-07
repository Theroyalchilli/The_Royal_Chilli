import supabase from "@/lib/supabase";

// Deplete ingredient stock for a paid order, based on each line item's
// recipe (recipe_ingredients scaled by the recipe's yield). Items with no
// recipe entered yet are silently skipped — this is additive/best-effort
// bookkeeping, never a condition for the sale itself, so callers should
// never let a failure here affect the payment response.
export async function depleteStockForOrder(orderId: number, staffId: number): Promise<void> {
  const { data: items } = await supabase
    .from("order_items")
    .select("menu_item_id, quantity")
    .eq("order_id", orderId)
    .neq("status", "cancelled");

  if (!items || items.length === 0) return;

  const menuItemIds = [...new Set(items.map((i) => i.menu_item_id).filter((id): id is number => id != null))];
  if (menuItemIds.length === 0) return;

  const { data: recipes } = await supabase
    .from("recipes")
    .select("id, menu_item_id, yield_quantity")
    .eq("active", 1)
    .in("menu_item_id", menuItemIds);

  if (!recipes || recipes.length === 0) return;

  const recipeByMenuItem = new Map(recipes.map((r) => [r.menu_item_id as number, { id: r.id, yield_quantity: Number(r.yield_quantity) || 1 }]));
  const recipeIds = recipes.map((r) => r.id);

  const { data: recipeIngredients } = await supabase
    .from("recipe_ingredients")
    .select("recipe_id, ingredient_id, quantity")
    .in("recipe_id", recipeIds);

  if (!recipeIngredients || recipeIngredients.length === 0) return;

  const ingredientsByRecipe = new Map<number, { ingredient_id: number; quantity: number }[]>();
  for (const ri of recipeIngredients) {
    const list = ingredientsByRecipe.get(ri.recipe_id) || [];
    list.push({ ingredient_id: ri.ingredient_id, quantity: Number(ri.quantity) });
    ingredientsByRecipe.set(ri.recipe_id, list);
  }

  // Combine into one delta per ingredient so a dish appearing twice in the
  // same order produces one movement row, not several.
  const deltaByIngredient = new Map<number, number>();
  for (const item of items) {
    if (item.menu_item_id == null) continue;
    const recipe = recipeByMenuItem.get(item.menu_item_id);
    if (!recipe) continue;
    const lines = ingredientsByRecipe.get(recipe.id) || [];
    for (const line of lines) {
      const used = (line.quantity / recipe.yield_quantity) * Number(item.quantity);
      deltaByIngredient.set(line.ingredient_id, (deltaByIngredient.get(line.ingredient_id) || 0) + used);
    }
  }

  if (deltaByIngredient.size === 0) return;

  const movements = [...deltaByIngredient.entries()].map(([ingredient_id, used]) => ({
    ingredient_id,
    movement_type: "usage" as const,
    quantity_delta: -Math.round(used * 1000) / 1000,
    reference_type: "order",
    reference_id: orderId,
    staff_id: staffId,
  }));

  await supabase.from("stock_movements").insert(movements);
}
