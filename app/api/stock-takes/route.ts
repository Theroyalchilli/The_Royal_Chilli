import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageInventory } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageInventory(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabase
    .from("stock_takes")
    .select("*, counted_staff:staff!stock_takes_counted_by_fkey(name)")
    .order("opened_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Failed to fetch stock takes" }, { status: 500 });

  const flat = (data || []).map((st) => {
    const { counted_staff: s, ...rest } = st as typeof st & { counted_staff: { name: string } | null };
    return { ...rest, counted_by_name: s?.name ?? null };
  });
  return NextResponse.json({ stockTakes: flat });
}

// Opens a take and snapshots current_stock per active ingredient as system_qty —
// snapshotting is essential: sales keep depleting stock during the count, so
// counts get compared against a frozen baseline, not a moving one.
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageInventory(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { location } = await req.json().catch(() => ({ location: "all" }));

    const { data: stockTake, error: stErr } = await supabase
      .from("stock_takes")
      .insert({ location: location || "all", counted_by: session.id })
      .select()
      .single();
    if (stErr) throw stErr;

    const { data: ingredients, error: ingErr } = await supabase.from("ingredients").select("id, current_stock").eq("active", 1);
    if (ingErr) throw ingErr;

    if ((ingredients || []).length > 0) {
      const lineRows = (ingredients || []).map((i) => ({
        stock_take_id: stockTake.id,
        ingredient_id: i.id,
        system_qty: i.current_stock,
      }));
      const { error: lineErr } = await supabase.from("stock_take_lines").insert(lineRows);
      if (lineErr) throw lineErr;
    }

    return NextResponse.json({ success: true, stockTake }, { status: 201 });
  } catch (error) {
    console.error("Stock take open error:", error);
    return NextResponse.json({ error: "Failed to open stock take" }, { status: 500 });
  }
}
