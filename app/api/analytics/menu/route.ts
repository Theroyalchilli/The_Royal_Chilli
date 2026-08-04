import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageStaff } from "@/lib/permissions";
import { getPaidOrdersInRange, getItemSalesInRange } from "@/lib/analytics";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageStaff(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "from and to are required" }, { status: 400 });

  const orders = await getPaidOrdersInRange(from, to);
  const items = await getItemSalesInRange(orders.map((o) => o.id));

  const byItem = new Map<string, { menu_item_id: number | null; quantity_sold: number; revenue: number }>();
  for (const i of items) {
    const cur = byItem.get(i.item_name) || { menu_item_id: i.menu_item_id, quantity_sold: 0, revenue: 0 };
    cur.quantity_sold += i.quantity;
    cur.revenue += Number(i.item_price) * i.quantity;
    byItem.set(i.item_name, cur);
  }

  // Recipe cost per menu_item, for profit margin.
  const { data: recipes } = await supabase.from("recipes").select("id, menu_item_id");
  const { data: recipeIngredients } = await supabase.from("recipe_ingredients").select("recipe_id, quantity, ingredient:ingredients(cost_per_unit)");
  const costByRecipe = new Map<number, number>();
  for (const ri of recipeIngredients || []) {
    const ing = ri.ingredient as unknown as { cost_per_unit: number } | null;
    const cost = Number(ri.quantity) * Number(ing?.cost_per_unit ?? 0);
    costByRecipe.set(ri.recipe_id, (costByRecipe.get(ri.recipe_id) || 0) + cost);
  }
  const costByMenuItem = new Map<number, number>();
  for (const r of recipes || []) {
    if (r.menu_item_id) costByMenuItem.set(r.menu_item_id, costByRecipe.get(r.id) || 0);
  }

  const ranked = Array.from(byItem.entries())
    .map(([item_name, v]) => {
      const revenue = Math.round(v.revenue * 100) / 100;
      const unitPrice = v.quantity_sold > 0 ? v.revenue / v.quantity_sold : 0;
      const recipeCost = v.menu_item_id ? costByMenuItem.get(v.menu_item_id) : undefined;
      const marginPct = recipeCost !== undefined && unitPrice > 0 ? Math.round(((unitPrice - recipeCost) / unitPrice) * 1000) / 10 : null;
      return { item_name, quantity_sold: v.quantity_sold, revenue, margin_pct: marginPct };
    })
    .sort((a, b) => b.quantity_sold - a.quantity_sold);

  const bestSellers = ranked.slice(0, 10);
  const worstSellers = [...ranked].sort((a, b) => a.quantity_sold - b.quantity_sold).slice(0, 10);

  return NextResponse.json({ best_sellers: bestSellers, worst_sellers: worstSellers });
}
