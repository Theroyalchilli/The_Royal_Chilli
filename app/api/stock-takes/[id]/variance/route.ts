import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageInventory } from "@/lib/permissions";

// Variance report: qty + value per line, plus a reason-code breakdown.
// 'unknown' is the shrinkage signal — over-portioning, untracked waste, or
// theft — trending its value over time is the single most useful number
// this module produces.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageInventory(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const { data: stockTake, error: stErr } = await supabase.from("stock_takes").select("*").eq("id", id).single();
  if (stErr || !stockTake) return NextResponse.json({ error: "Stock take not found" }, { status: 404 });

  const { data: lines, error: linesErr } = await supabase
    .from("stock_take_lines")
    .select("*, ingredient:ingredients(name, unit, cost_per_unit)")
    .eq("stock_take_id", id)
    .neq("variance_qty", 0);
  if (linesErr) return NextResponse.json({ error: "Failed to fetch variance" }, { status: 500 });

  const flat = (lines || []).map((l) => {
    const { ingredient: i, ...rest } = l as typeof l & { ingredient: { name: string; unit: string; cost_per_unit: number } | null };
    const value = l.variance_value ?? Math.round(Number(l.variance_qty) * Number(i?.cost_per_unit ?? 0) * 100) / 100;
    return { ...rest, ingredient_name: i?.name ?? null, unit: i?.unit ?? null, variance_value: value };
  });

  const byReason: Record<string, number> = {};
  for (const l of flat) {
    const key = l.reason_code || "uncategorised";
    byReason[key] = Math.round(((byReason[key] || 0) + Number(l.variance_value)) * 100) / 100;
  }

  const totalValue = Math.round(flat.reduce((s, l) => s + Number(l.variance_value), 0) * 100) / 100;

  return NextResponse.json({ stockTake, lines: flat, totalValue, byReason });
}
