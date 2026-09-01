import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageInventory } from "@/lib/permissions";

// Hands an open count over for approval — no ledger writes yet, just a
// status flip. Posting (which writes stock_movements) now only happens
// from the submitted state, via a separate approve_stock_takes-gated route.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageInventory(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

    const { data: stockTake, error: stErr } = await supabase.from("stock_takes").select("status").eq("id", id).single();
    if (stErr || !stockTake) return NextResponse.json({ error: "Stock take not found" }, { status: 404 });
    if (stockTake.status !== "open") {
      return NextResponse.json({ error: `Stock take is already ${stockTake.status}` }, { status: 400 });
    }

    const { data: submitted, error: subErr } = await supabase
      .from("stock_takes")
      .update({ status: "submitted" })
      .eq("id", id)
      .select()
      .single();
    if (subErr) throw subErr;

    return NextResponse.json({ success: true, stockTake: submitted });
  } catch (error) {
    console.error("Stock take submit error:", error);
    return NextResponse.json({ error: "Failed to submit stock take" }, { status: 500 });
  }
}
