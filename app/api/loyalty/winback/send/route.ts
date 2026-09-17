import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageCrm } from "@/lib/permissions";
import { issueRedemption } from "@/lib/loyalty";
import { sendWinBackEmail } from "@/lib/email";

// Manual win-back trigger — staff pick a reward and a customer, this issues
// a real redemption code (same mechanism as any other reward) and emails
// it. Never sent without marketing_consent: loyalty membership doesn't
// imply consent to be emailed non-transactionally.
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageCrm(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { customer_id, reward_id } = await req.json();
    if (!customer_id || !reward_id) return NextResponse.json({ error: "customer_id and reward_id are required" }, { status: 400 });

    const { data: customer } = await supabase.from("customers").select("id, name, email, marketing_consent").eq("id", customer_id).single();
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    if (!customer.marketing_consent) {
      return NextResponse.json({ error: "This customer hasn't opted into marketing emails" }, { status: 400 });
    }
    if (!customer.email) {
      return NextResponse.json({ error: "This customer has no email on file" }, { status: 400 });
    }

    const result = await issueRedemption(Number(customer_id), Number(reward_id), session.id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    await sendWinBackEmail(customer.email, {
      customerName: customer.name,
      rewardName: result.rewardName,
      code: result.redemption.code,
      expiresAt: result.redemption.expires_at as string,
    });

    return NextResponse.json({ success: true, code: result.redemption.code });
  } catch (error) {
    console.error("Win-back send error:", error);
    return NextResponse.json({ error: "Failed to send win-back offer" }, { status: 500 });
  }
}
