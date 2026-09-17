import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";

// Records cash physically removed from the till mid-shift (paying a
// delivery driver, petty cash for supplies) — scoped to whichever work
// period is currently open, so EOD's Expected Cash can subtract it back out.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amount, reason } = await req.json().catch(() => ({}));
  if (!amount || Number(amount) <= 0) {
    return NextResponse.json({ error: "Amount is required" }, { status: 400 });
  }
  if (!reason || !String(reason).trim()) {
    return NextResponse.json({ error: "A reason is required" }, { status: 400 });
  }

  const { data: period, error: periodError } = await supabase
    .from("work_periods")
    .select("id")
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (periodError) return NextResponse.json({ error: periodError.message }, { status: 500 });
  if (!period) return NextResponse.json({ error: "No till is currently open" }, { status: 400 });

  const { error } = await supabase.from("cash_paid_outs").insert({
    work_period_id: period.id,
    amount: Number(amount),
    reason: String(reason).trim(),
    staff_id: session.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
