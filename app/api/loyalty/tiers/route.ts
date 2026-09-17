import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canViewCrm, canManageCrm } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canViewCrm(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabase
    .from("loyalty_tiers")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ error: "Failed to fetch tiers" }, { status: 500 });
  return NextResponse.json({ tiers: data });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageCrm(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { name, min_lifetime_spend, points_multiplier, sort_order } = await req.json();
    if (!name || min_lifetime_spend == null || points_multiplier == null) {
      return NextResponse.json({ error: "name, min_lifetime_spend and points_multiplier are required" }, { status: 400 });
    }
    const { data, error } = await supabase
      .from("loyalty_tiers")
      .insert({
        name,
        min_lifetime_spend: Number(min_lifetime_spend),
        points_multiplier: Number(points_multiplier),
        sort_order: sort_order != null ? Number(sort_order) : 0,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, tier: data }, { status: 201 });
  } catch (error) {
    console.error("Tier create error:", error);
    return NextResponse.json({ error: "Failed to create tier" }, { status: 500 });
  }
}
