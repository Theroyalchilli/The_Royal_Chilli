import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getCustomerSessionFromRequest } from "@/lib/customer-auth";
import { issueRedemption } from "@/lib/loyalty";

// Self-service version of the same issueRedemption staff already use from
// Staff Hub — points are debited immediately (not held), same as any other
// staff-issued redemption; staffId is null to mark it as self-issued.
export async function POST(req: NextRequest) {
  try {
    const session = await getCustomerSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { reward_id } = await req.json();
    if (!reward_id) return NextResponse.json({ error: "reward_id is required" }, { status: 400 });

    // Only one active voucher at a time — matches "one reward per transaction".
    const { data: existing } = await supabase
      .from("loyalty_redemptions")
      .select("id")
      .eq("customer_id", session.id)
      .eq("status", "issued")
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "You already have an active voucher — cancel it first to redeem a different reward" }, { status: 409 });
    }

    const result = await issueRedemption(session.id, Number(reward_id), null);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    return NextResponse.json({ success: true, redemption: result.redemption });
  } catch (error) {
    console.error("Self-issue redemption error:", error);
    return NextResponse.json({ error: "Failed to redeem reward" }, { status: 500 });
  }
}
