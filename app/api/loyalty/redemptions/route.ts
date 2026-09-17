import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { canViewCrm } from "@/lib/permissions";
import { issueRedemption } from "@/lib/loyalty";

// Issue a redemption: debit points now, hand the customer a code to bring
// back (same visit or a later one). Two steps — issue, then redeem at POS —
// rather than an instant apply, so there's a real audit trail of who issued
// it, whether it was ever used, and against which order.
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canViewCrm(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { customer_id, reward_id } = await req.json();
    if (!customer_id || !reward_id) {
      return NextResponse.json({ error: "customer_id and reward_id are required" }, { status: 400 });
    }

    const result = await issueRedemption(Number(customer_id), Number(reward_id), session.id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    return NextResponse.json({ success: true, redemption: { ...result.redemption, reward_name: result.rewardName } }, { status: 201 });
  } catch (error) {
    console.error("Redemption issue error:", error);
    return NextResponse.json({ error: "Failed to issue redemption" }, { status: 500 });
  }
}
