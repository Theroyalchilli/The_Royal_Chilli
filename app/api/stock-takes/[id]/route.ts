import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageInventory } from "@/lib/permissions";

// The count sheet: every line with system vs counted qty (and variance, since
// it's a generated column so it's always live even before posting).
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
    .select("*, ingredient:ingredients(name, unit)")
    .eq("stock_take_id", id)
    .order("id");
  if (linesErr) return NextResponse.json({ error: "Failed to fetch stock take lines" }, { status: 500 });

  const flat = (lines || []).map((l) => {
    const { ingredient: i, ...rest } = l as typeof l & { ingredient: { name: string; unit: string } | null };
    return { ...rest, ingredient_name: i?.name ?? null, unit: i?.unit ?? null };
  });

  return NextResponse.json({ stockTake, lines: flat });
}
