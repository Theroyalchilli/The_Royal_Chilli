import supabase from "@/lib/supabase";

export async function getVatRate(): Promise<number> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "vat_rate").maybeSingle();
  return data ? Number(data.value) : 0.2;
}

// Menu prices are VAT-inclusive, so the VAT portion of a gross figure is gross * (rate / (1 + rate)).
export function extractVat(grossAmount: number, vatRate: number): number {
  return Math.round(grossAmount * (vatRate / (1 + vatRate)) * 100) / 100;
}

export async function getRevenue(from: string, to: string): Promise<number> {
  const { data } = await supabase
    .from("orders")
    .select("total")
    .eq("status", "paid")
    .gte("created_at", `${from}T00:00:00.000Z`)
    .lte("created_at", `${to}T23:59:59.999Z`);
  return Math.round((data || []).reduce((s, o) => s + Number(o.total), 0) * 100) / 100;
}

export async function getIngredientPurchases(from: string, to: string): Promise<number> {
  const { data } = await supabase
    .from("purchase_orders")
    .select("total_cost")
    .eq("status", "received")
    .gte("received_date", from)
    .lte("received_date", to);
  return Math.round((data || []).reduce((s, po) => s + Number(po.total_cost), 0) * 100) / 100;
}

export async function getLabourCost(from: string, to: string): Promise<number> {
  const { data } = await supabase
    .from("payroll_entries")
    .select("gross_pay, payroll_periods!inner(period_start, period_end)")
    .gte("payroll_periods.period_start", from)
    .lte("payroll_periods.period_end", to);
  return Math.round((data || []).reduce((s, e) => s + Number(e.gross_pay), 0) * 100) / 100;
}

// Real (accrual) cost of goods sold: for every paid order in the period, cost
// each line item at its recipe cost (recipe_ingredients quantity * ingredient
// cost_per_unit, scaled by the recipe's yield). Items with no recipe entered
// yet contribute 0 cost and are excluded from the coverage % — this is
// necessarily partial until recipes are entered for the full menu, so it's
// reported alongside a coverage figure rather than presented as complete.
export async function getRecipeCogs(from: string, to: string): Promise<{
  cogs: number;
  costedRevenue: number;
  totalRevenue: number;
  coveragePct: number;
}> {
  const { data: paidOrders } = await supabase
    .from("orders")
    .select("id, total")
    .eq("status", "paid")
    .gte("created_at", `${from}T00:00:00.000Z`)
    .lte("created_at", `${to}T23:59:59.999Z`);

  const orderIds = (paidOrders || []).map((o) => o.id);
  const totalRevenue = Math.round((paidOrders || []).reduce((s, o) => s + Number(o.total), 0) * 100) / 100;
  if (orderIds.length === 0) return { cogs: 0, costedRevenue: 0, totalRevenue: 0, coveragePct: 0 };

  const { data: items } = await supabase
    .from("order_items")
    .select("order_id, menu_item_id, item_price, quantity")
    .in("order_id", orderIds)
    .neq("status", "cancelled");

  const { data: recipes } = await supabase
    .from("recipes")
    .select("id, menu_item_id, yield_quantity")
    .eq("active", 1);

  const recipeByMenuItem = new Map<number, { id: number; yield_quantity: number }>();
  for (const r of recipes || []) {
    if (r.menu_item_id != null) recipeByMenuItem.set(r.menu_item_id, { id: r.id, yield_quantity: Number(r.yield_quantity) || 1 });
  }

  const recipeIds = [...recipeByMenuItem.values()].map((r) => r.id);
  const { data: recipeIngredients } = recipeIds.length > 0
    ? await supabase.from("recipe_ingredients").select("recipe_id, quantity, ingredient:ingredients(cost_per_unit)").in("recipe_id", recipeIds)
    : { data: [] };

  const costPerRecipe = new Map<number, number>();
  for (const ri of recipeIngredients || []) {
    const ing = ri.ingredient as unknown as { cost_per_unit: number } | null;
    const cost = Number(ri.quantity) * Number(ing?.cost_per_unit ?? 0);
    costPerRecipe.set(ri.recipe_id, (costPerRecipe.get(ri.recipe_id) || 0) + cost);
  }

  let cogs = 0;
  let costedRevenue = 0;
  for (const item of items || []) {
    if (item.menu_item_id == null) continue;
    const recipe = recipeByMenuItem.get(item.menu_item_id);
    if (!recipe) continue;
    const costPerPortion = (costPerRecipe.get(recipe.id) || 0) / recipe.yield_quantity;
    cogs += costPerPortion * Number(item.quantity);
    costedRevenue += Number(item.item_price) * Number(item.quantity);
  }

  return {
    cogs: Math.round(cogs * 100) / 100,
    costedRevenue: Math.round(costedRevenue * 100) / 100,
    totalRevenue,
    coveragePct: totalRevenue > 0 ? Math.round((costedRevenue / totalRevenue) * 1000) / 10 : 0,
  };
}

export async function getOtherExpenses(from: string, to: string): Promise<{ total: number; vatApplicableTotal: number }> {
  const { data } = await supabase
    .from("expenses")
    .select("amount, vat_applicable")
    .gte("expense_date", from)
    .lte("expense_date", to);
  const total = Math.round((data || []).reduce((s, e) => s + Number(e.amount), 0) * 100) / 100;
  const vatApplicableTotal = Math.round((data || []).filter((e) => e.vat_applicable).reduce((s, e) => s + Number(e.amount), 0) * 100) / 100;
  return { total, vatApplicableTotal };
}
