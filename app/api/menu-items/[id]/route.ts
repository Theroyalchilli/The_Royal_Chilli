import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageStaff } from "@/lib/permissions";

const EDITABLE_FIELDS = [
  "category_id", "name", "description", "price", "is_veg", "active", "display_order",
  "allergens", "calories", "protein_g", "carbs_g", "fat_g",
];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageStaff(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const body = await req.json();
    const updates: Record<string, unknown> = {};
    for (const field of EDITABLE_FIELDS) if (field in body) updates[field] = body[field];
    // is_veg/active are INT (0/1) columns — a JS boolean from the client would
    // hit Postgres as the literal string "true"/"false" and fail with 22P02.
    if ("is_veg" in updates) updates.is_veg = updates.is_veg ? 1 : 0;
    if ("active" in updates) updates.active = updates.active ? 1 : 0;
    if (Object.keys(updates).length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });

    const { data, error } = await supabase.from("menu_items").update(updates).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, item: data });
  } catch (error) {
    console.error("Menu item update error:", error);
    return NextResponse.json({ error: "Failed to update menu item" }, { status: 500 });
  }
}
