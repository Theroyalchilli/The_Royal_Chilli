import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageFinance } from "@/lib/permissions";
import { getRevenue, getIngredientPurchases, getLabourCost, getOtherExpenses, getRecipeCogs } from "@/lib/finance";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageFinance(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "from and to are required" }, { status: 400 });

  const [revenue, ingredientPurchases, labourCost, expenses, recipeCogs] = await Promise.all([
    getRevenue(from, to),
    getIngredientPurchases(from, to),
    getLabourCost(from, to),
    getOtherExpenses(from, to),
    getRecipeCogs(from, to),
  ]);

  // Bottom line still uses ingredient purchases (cash basis) — recipe COGS is
  // surfaced alongside it, not swapped in, until enough of the menu has
  // costed recipes for it to be a trustworthy accrual figure.
  const netProfit = Math.round((revenue - ingredientPurchases - labourCost - expenses.total) * 100) / 100;
  const netProfitRecipeBasis = Math.round((revenue - recipeCogs.cogs - labourCost - expenses.total) * 100) / 100;

  return NextResponse.json({
    from, to, revenue,
    ingredient_purchases: ingredientPurchases,
    labour_cost: labourCost,
    other_expenses: expenses.total,
    net_profit: netProfit,
    recipe_cogs: recipeCogs.cogs,
    recipe_cogs_coverage_pct: recipeCogs.coveragePct,
    net_profit_recipe_basis: netProfitRecipeBasis,
  });
}
