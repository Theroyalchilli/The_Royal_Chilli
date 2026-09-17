import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canViewCrm } from "@/lib/permissions";

// Read-only lookup — lets staff preview a code (name, discount, expiry)
// before committing to /redeem against a specific order.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canViewCrm(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { code } = await req.json();
  if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });

  const { data: redemption, error } = await supabase
    .from("loyalty_redemptions")
    .select("*, reward:loyalty_rewards(name, description, discount_amount, min_spend), customer:customers(name, phone)")
    .eq("code", String(code).trim().toUpperCase())
    .maybeSingle();
  if (error || !redemption) return NextResponse.json({ error: "INVALID_CODE", message: "No reward found with that code" }, { status: 404 });

  if (redemption.status === "redeemed") {
    return NextResponse.json({ error: "ALREADY_REDEEMED", message: "This code has already been used" }, { status: 400 });
  }
  if (redemption.status === "cancelled") {
    return NextResponse.json({ error: "CANCELLED", message: "This code was cancelled" }, { status: 400 });
  }
  if (redemption.status === "expired" || new Date(redemption.expires_at) < new Date()) {
    return NextResponse.json({ error: "REWARD_EXPIRED", message: "This code has expired" }, { status: 400 });
  }

  return NextResponse.json({ valid: true, redemption });
}
