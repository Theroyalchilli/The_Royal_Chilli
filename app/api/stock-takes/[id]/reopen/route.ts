import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canApproveStockTakes } from "@/lib/permissions";

// The approver's reject path: sends a submitted count back to 'open' for a
// recount instead of posting it. Counted quantities/reason codes are left
// as-is so the counting staff can review and correct rather than start over.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canApproveStockTakes(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

    const { data: stockTake, error: stErr } = await supabase.from("stock_takes").select("status").eq("id", id).single();
    if (stErr || !stockTake) return NextResponse.json({ error: "Stock take not found" }, { status: 404 });
    if (stockTake.status !== "submitted") {
      return NextResponse.json({ error: `Stock take is ${stockTake.status}, not submitted` }, { status: 400 });
    }

    const { data: reopened, error: reopenErr } = await supabase
      .from("stock_takes")
      .update({ status: "open" })
      .eq("id", id)
      .select()
      .single();
    if (reopenErr) throw reopenErr;

    return NextResponse.json({ success: true, stockTake: reopened });
  } catch (error) {
    console.error("Stock take reopen error:", error);
    return NextResponse.json({ error: "Failed to reopen stock take" }, { status: 500 });
  }
}
