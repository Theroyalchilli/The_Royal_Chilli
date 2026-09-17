import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canViewCrm } from "@/lib/permissions";

// Admin-facing redemption activity log (doc §20 "Redemptions — view and
// filter redemption activity"). Most recent first, capped — this is a log
// view, not a paginated export.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canViewCrm(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabase
    .from("loyalty_redemptions")
    .select("id, code, status, points_spent, issued_at, expires_at, redeemed_at, reward:loyalty_rewards(name), customer:customers(name, phone)")
    .order("issued_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: "Failed to fetch redemptions" }, { status: 500 });
  return NextResponse.json({ redemptions: data });
}
