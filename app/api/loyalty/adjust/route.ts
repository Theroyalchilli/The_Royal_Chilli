import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageCrm } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageCrm(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { customer_id, points_delta, reason } = await req.json();
    if (!customer_id || !points_delta) return NextResponse.json({ error: "customer_id and points_delta are required" }, { status: 400 });

    const { error } = await supabase.from("loyalty_transactions").insert({
      customer_id, points_delta: Number(points_delta), reason: "manual_adjustment",
      reference_type: reason ? "note" : null, staff_id: session.id,
    });
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Adjust error:", error);
    return NextResponse.json({ error: "Failed to adjust points" }, { status: 500 });
  }
}
