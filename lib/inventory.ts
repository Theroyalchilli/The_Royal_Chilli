import supabase from "@/lib/supabase";

export type ReconciliationLine = {
  ingredient_id: number;
  ingredient_name: string;
  unit: string;
  theoretical_usage: number;
  actual_usage: number;
  variance_qty: number;
  variance_value: number;
};

export type ReconciliationReport = {
  period: { from: string; to: string };
  net_sales: number;
  cogs_theoretical: number;
  cogs_actual: number;
  gp_theoretical: number | null;
  gp_actual: number | null;
  gp_gap: number | null;
  lines: ReconciliationLine[];
};

// Deplete ingredient stock for a paid order, based on each line item's
// recipe (recipe_ingredients scaled by the recipe's yield). Items with no
// recipe entered yet are silently skipped — this is additive/best-effort
// bookkeeping, never a condition for the sale itself, so callers should
// never let a failure here affect the payment response.
export async function depleteStockForOrder(orderId: number, staffId: number): Promise<void> {
  // Both Pay Later and an eventual full payment call this for the same
  // order — without this guard, a Pay Later order that later gets paid off
  // has its stock deducted twice for the same food.
  const { data: existing } = await supabase
    .from("stock_movements")
    .select("id")
    .eq("reference_type", "order")
    .eq("reference_id", orderId)
    .eq("movement_type", "usage")
    .limit(1);
  if (existing && existing.length > 0) return;

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

// Pure rollup: theoretical usage (what the recipes say should have been used,
// given what actually sold) vs actual usage (what the ledger says left stock)
// per ingredient, valued at last-known cost. The gap between the two GP%
// figures is the money leaking through waste, over-portioning and shrinkage —
// stock-vs-sales, as distinct from a stock-take's stock-vs-stock check.
export function buildReconciliationReport(
  from: string,
  to: string,
  netSales: number,
  ingredients: { id: number; name: string; unit: string; cost_per_unit: number }[],
  theoreticalUsage: Map<number, number>,
  actualUsage: Map<number, number>
): ReconciliationReport {
  const ingredientById = new Map(ingredients.map((i) => [i.id, i]));
  const ids = new Set<number>([...theoreticalUsage.keys(), ...actualUsage.keys()]);

  let cogsTheoretical = 0;
  let cogsActual = 0;
  const lines: ReconciliationLine[] = [];

  for (const id of ids) {
    const ing = ingredientById.get(id);
    if (!ing) continue;
    const theoretical = theoreticalUsage.get(id) || 0;
    const actual = actualUsage.get(id) || 0;
    const varianceQty = actual - theoretical;
    cogsTheoretical += theoretical * ing.cost_per_unit;
    cogsActual += actual * ing.cost_per_unit;
    lines.push({
      ingredient_id: id,
      ingredient_name: ing.name,
      unit: ing.unit,
      theoretical_usage: Math.round(theoretical * 1000) / 1000,
      actual_usage: Math.round(actual * 1000) / 1000,
      variance_qty: Math.round(varianceQty * 1000) / 1000,
      variance_value: Math.round(varianceQty * ing.cost_per_unit * 100) / 100,
    });
  }
  lines.sort((a, b) => Math.abs(b.variance_value) - Math.abs(a.variance_value));

  cogsTheoretical = Math.round(cogsTheoretical * 100) / 100;
  cogsActual = Math.round(cogsActual * 100) / 100;
  const gpTheoretical = netSales > 0 ? Math.round(((netSales - cogsTheoretical) / netSales) * 1000) / 10 : null;
  const gpActual = netSales > 0 ? Math.round(((netSales - cogsActual) / netSales) * 1000) / 10 : null;
  const gpGap = gpTheoretical != null && gpActual != null ? Math.round((gpTheoretical - gpActual) * 10) / 10 : null;

  return {
    period: { from, to },
    net_sales: netSales,
    cogs_theoretical: cogsTheoretical,
    cogs_actual: cogsActual,
    gp_theoretical: gpTheoretical,
    gp_actual: gpActual,
    gp_gap: gpGap,
    lines,
  };
}

// GET /reports/reconciliation — stock-vs-sales, only trustworthy once a
// stock-take has posted for the period (see SPEC: two different reconciliations).
export async function getReconciliationReport(from: string, to: string): Promise<ReconciliationReport> {
  const { data: paidOrders } = await supabase
    .from("orders")
    .select("id, total")
    .eq("status", "paid")
    .gte("created_at", `${from}T00:00:00.000Z`)
    .lte("created_at", `${to}T23:59:59.999Z`);

  const orderIds = (paidOrders || []).map((o) => o.id);
  const netSales = Math.round((paidOrders || []).reduce((s, o) => s + Number(o.total), 0) * 100) / 100;

  // Theoretical usage: recipe depletion for every item actually sold in the period
  // (same math as depleteStockForOrder, aggregated across the date range instead of one order).
  const theoreticalUsage = new Map<number, number>();
  if (orderIds.length > 0) {
    const { data: items } = await supabase
      .from("order_items")
      .select("menu_item_id, quantity")
      .in("order_id", orderIds)
      .neq("status", "cancelled");

    const menuItemIds = [...new Set((items || []).map((i) => i.menu_item_id).filter((id): id is number => id != null))];
    if (menuItemIds.length > 0) {
      const { data: recipes } = await supabase
        .from("recipes")
        .select("id, menu_item_id, yield_quantity")
        .eq("active", 1)
        .in("menu_item_id", menuItemIds);

      const recipeByMenuItem = new Map((recipes || []).map((r) => [r.menu_item_id as number, { id: r.id, yield_quantity: Number(r.yield_quantity) || 1 }]));
      const recipeIds = (recipes || []).map((r) => r.id);
      const { data: recipeIngredients } = recipeIds.length > 0
        ? await supabase.from("recipe_ingredients").select("recipe_id, ingredient_id, quantity").in("recipe_id", recipeIds)
        : { data: [] };

      const linesByRecipe = new Map<number, { ingredient_id: number; quantity: number }[]>();
      for (const ri of recipeIngredients || []) {
        const list = linesByRecipe.get(ri.recipe_id) || [];
        list.push({ ingredient_id: ri.ingredient_id, quantity: Number(ri.quantity) });
        linesByRecipe.set(ri.recipe_id, list);
      }

      for (const item of items || []) {
        if (item.menu_item_id == null) continue;
        const recipe = recipeByMenuItem.get(item.menu_item_id);
        if (!recipe) continue;
        for (const line of linesByRecipe.get(recipe.id) || []) {
          const used = (line.quantity / recipe.yield_quantity) * Number(item.quantity);
          theoreticalUsage.set(line.ingredient_id, (theoreticalUsage.get(line.ingredient_id) || 0) + used);
        }
      }
    }
  }

  // Actual usage: opening + receipts - closing collapses algebraically to just
  // "everything that left the ledger other than a purchase, negated" — the
  // opening/closing balances themselves cancel out, so there's no need to sum
  // the ledger from the beginning of time.
  const actualUsage = new Map<number, number>();
  const { data: movements } = await supabase
    .from("stock_movements")
    .select("ingredient_id, quantity_delta")
    .neq("movement_type", "purchase")
    .gte("created_at", `${from}T00:00:00.000Z`)
    .lte("created_at", `${to}T23:59:59.999Z`);
  for (const m of movements || []) {
    actualUsage.set(m.ingredient_id, (actualUsage.get(m.ingredient_id) || 0) - Number(m.quantity_delta));
  }

  const { data: ingredients } = await supabase.from("ingredients").select("id, name, unit, cost_per_unit");

  return buildReconciliationReport(from, to, netSales, ingredients || [], theoreticalUsage, actualUsage);
}
