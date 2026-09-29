import supabase from "@/lib/supabase";

// The one place recipe maths happens. Stock depletion on a sale, recipe-based
// COGS in Finance and the theoretical side of Inventory → Reconciliation all
// go through here, so the same sale always costs the same and uses the same
// stock everywhere.

export type RecipeBook = Map<
  number, // menu_item_id
  { recipeId: number; perPortion: { ingredient_id: number; quantity: number }[]; costPerPortion: number }
>;

export type SoldItem = { menu_item_id: number | null; quantity: number; item_price?: number };

/** Active recipes linked to menu items (optionally only these menu items). */
export async function loadRecipeBook(menuItemIds?: number[]): Promise<RecipeBook> {
  const book: RecipeBook = new Map();
  if (menuItemIds && menuItemIds.length === 0) return book;

  let q = supabase.from("recipes").select("id, menu_item_id, yield_quantity").eq("active", 1).not("menu_item_id", "is", null);
  if (menuItemIds) q = q.in("menu_item_id", menuItemIds);
  const { data: recipes, error } = await q.order("id");
  if (error) throw error;
  if (!recipes || recipes.length === 0) return book;

  const { data: lines, error: linesErr } = await supabase
    .from("recipe_ingredients")
    .select("recipe_id, ingredient_id, quantity, ingredient:ingredients(cost_per_unit)")
    .in("recipe_id", recipes.map((r) => r.id));
  if (linesErr) throw linesErr;

  // If two active recipes point at the same dish, the newest (highest id) wins — everywhere.
  for (const r of recipes) {
    const yieldQty = Number(r.yield_quantity) || 1;
    const perPortion: { ingredient_id: number; quantity: number }[] = [];
    let cost = 0;
    for (const l of lines ?? []) {
      if (l.recipe_id !== r.id) continue;
      const qty = Number(l.quantity) / yieldQty;
      const ing = l.ingredient as unknown as { cost_per_unit: number } | null;
      perPortion.push({ ingredient_id: l.ingredient_id, quantity: qty });
      cost += qty * Number(ing?.cost_per_unit ?? 0);
    }
    book.set(r.menu_item_id as number, { recipeId: r.id, perPortion, costPerPortion: cost });
  }
  return book;
}

/** Ingredients used, recipe cost, and how much of the item revenue had a recipe. */
export function recipeUsage(book: RecipeBook, items: SoldItem[]): {
  usage: Map<number, number>;
  cogs: number;
  costedRevenue: number;
  itemRevenue: number;
} {
  const usage = new Map<number, number>();
  let cogs = 0;
  let costedRevenue = 0;
  let itemRevenue = 0;
  for (const item of items) {
    const qty = Number(item.quantity);
    const lineRevenue = Number(item.item_price ?? 0) * qty;
    itemRevenue += lineRevenue;
    const recipe = item.menu_item_id != null ? book.get(item.menu_item_id) : undefined;
    if (!recipe) continue;
    cogs += recipe.costPerPortion * qty;
    costedRevenue += lineRevenue;
    for (const line of recipe.perPortion) {
      usage.set(line.ingredient_id, (usage.get(line.ingredient_id) ?? 0) + line.quantity * qty);
    }
  }
  return { usage, cogs, costedRevenue, itemRevenue };
}
