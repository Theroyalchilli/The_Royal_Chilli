import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canViewCrm, canManageCrm } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canViewCrm(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabase.from("loyalty_rewards").select("*").eq("active", 1).order("points_cost");
  if (error) return NextResponse.json({ error: "Failed to fetch rewards" }, { status: 500 });
  return NextResponse.json({ rewards: data });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageCrm(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { name, description, points_cost } = await req.json();
    if (!name || !points_cost) return NextResponse.json({ error: "Name and points_cost are required" }, { status: 400 });

    const { data, error } = await supabase.from("loyalty_rewards").insert({ name, description: description || null, points_cost }).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, reward: data }, { status: 201 });
  } catch (error) {
    console.error("Reward create error:", error);
    return NextResponse.json({ error: "Failed to create reward" }, { status: 500 });
  }
}
