import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canViewCrm } from "@/lib/permissions";

// Admin-facing redemption activity log (doc §20 "Redemptions — view and
// filter redemption activity"). Most recent first, capped — this is a log
// view, not a paginated export. An optional `to` date (YYYY-MM-DD) narrows
// it to codes issued on or before that day, same "up to this date" cutoff
// convention as History's Pending Bills filter.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canViewCrm(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const to = req.nextUrl.searchParams.get("to");
  let query = supabase
    .from("loyalty_redemptions")
    .select("id, code, status, points_spent, issued_at, expires_at, redeemed_at, reward:loyalty_rewards(name), customer:customers(name, phone)")
    .order("issued_at", { ascending: false })
    .limit(100);
  if (to) {
    const endOfDay = new Date(`${to}T23:59:59.999`);
    if (!isNaN(endOfDay.getTime())) query = query.lte("issued_at", endOfDay.toISOString());
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to fetch redemptions" }, { status: 500 });
  return NextResponse.json({ redemptions: data });
}
