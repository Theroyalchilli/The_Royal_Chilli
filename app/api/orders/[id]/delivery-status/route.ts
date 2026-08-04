import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";

const VALID_TRANSITIONS: Record<string, string[]> = {
  assigned: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
};

// A driver updates the status of their own assigned delivery.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { status } = await req.json();

    const { data: order, error: fetchErr } = await supabase.from("orders").select("driver_id, delivery_status").eq("id", id).single();
    if (fetchErr || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.driver_id !== session.id) return NextResponse.json({ error: "This delivery isn't assigned to you" }, { status: 403 });

    const allowed = VALID_TRANSITIONS[order.delivery_status || ""] || [];
    if (!allowed.includes(status)) {
      return NextResponse.json({ error: `Cannot move from ${order.delivery_status} to ${status}` }, { status: 400 });
    }

    const updates: Record<string, unknown> = { delivery_status: status, updated_at: new Date().toISOString() };
    if (status === "delivered") updates.status = "paid"; // cash-on-delivery orders are settled once delivered

    const { data, error } = await supabase.from("orders").update(updates).eq("id", id).select().single();
    if (error) throw error;

    return NextResponse.json({ success: true, order: data });
  } catch (error) {
    console.error("Delivery status error:", error);
    return NextResponse.json({ error: "Failed to update delivery status" }, { status: 500 });
  }
}
