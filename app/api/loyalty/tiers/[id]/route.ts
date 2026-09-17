import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageCrm } from "@/lib/permissions";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageCrm(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const { name, min_lifetime_spend, points_multiplier, sort_order, active } = await req.json();

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (min_lifetime_spend !== undefined) updates.min_lifetime_spend = Number(min_lifetime_spend);
    if (points_multiplier !== undefined) updates.points_multiplier = Number(points_multiplier);
    if (sort_order !== undefined) updates.sort_order = Number(sort_order);
    if (active !== undefined) updates.active = active ? 1 : 0;

    const { data, error } = await supabase.from("loyalty_tiers").update(updates).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, tier: data });
  } catch (error) {
    console.error("Tier update error:", error);
    return NextResponse.json({ error: "Failed to update tier" }, { status: 500 });
  }
}
