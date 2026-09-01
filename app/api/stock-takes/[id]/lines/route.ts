import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageInventory } from "@/lib/permissions";

// Enter counted quantities (and optional reason) while a take is still open.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageInventory(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const { lines } = await req.json(); // [{ ingredient_id, counted_qty, reason_code? }]
    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: "lines is required" }, { status: 400 });
    }

    const { data: stockTake, error: stErr } = await supabase.from("stock_takes").select("status").eq("id", id).single();
    if (stErr || !stockTake) return NextResponse.json({ error: "Stock take not found" }, { status: 404 });
    if (stockTake.status !== "open") {
      return NextResponse.json({ error: `Cannot edit counts on a ${stockTake.status} stock take` }, { status: 400 });
    }

    for (const line of lines as { ingredient_id: number; counted_qty: number; reason_code?: string }[]) {
      const { error } = await supabase
        .from("stock_take_lines")
        .update({ counted_qty: line.counted_qty, reason_code: line.reason_code || null })
        .eq("stock_take_id", id)
        .eq("ingredient_id", line.ingredient_id);
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Stock take line update error:", error);
    return NextResponse.json({ error: "Failed to update stock take lines" }, { status: 500 });
  }
}
