import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageInventory } from "@/lib/permissions";

// current_stock is deliberately not editable here — it only changes via stock_movements,
// so there's always an audit trail for why stock went up or down.
const EDITABLE_FIELDS = ["name", "unit", "reorder_level", "reorder_quantity", "cost_per_unit", "supplier_id", "active"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageInventory(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const body = await req.json();
    const updates: Record<string, unknown> = {};
    for (const field of EDITABLE_FIELDS) if (field in body) updates[field] = body[field];
    if (Object.keys(updates).length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });

    const { data, error } = await supabase.from("ingredients").update(updates).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, ingredient: data });
  } catch (error) {
    console.error("Ingredient update error:", error);
    return NextResponse.json({ error: "Failed to update ingredient" }, { status: 500 });
  }
}
