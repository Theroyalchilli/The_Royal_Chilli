import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageFinance } from "@/lib/permissions";
import { getRevenue, getIngredientPurchases, getLabourCost, getOtherExpenses } from "@/lib/finance";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageFinance(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "from and to are required" }, { status: 400 });

  const [revenue, ingredientPurchases, labourCost, expenses] = await Promise.all([
    getRevenue(from, to),
    getIngredientPurchases(from, to),
    getLabourCost(from, to),
    getOtherExpenses(from, to),
  ]);

  const netProfit = Math.round((revenue - ingredientPurchases - labourCost - expenses.total) * 100) / 100;

  return NextResponse.json({
    from, to, revenue,
    ingredient_purchases: ingredientPurchases,
    labour_cost: labourCost,
    other_expenses: expenses.total,
    net_profit: netProfit,
  });
}
