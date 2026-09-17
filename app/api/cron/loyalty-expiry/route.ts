import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

// Point types that actually "expire" — a manual adjustment is a deliberate
// correction, not points a customer earned and might forget about, so it's
// left out of the sweep.
const EXPIRABLE_REASONS = ["earned_purchase", "tier_bonus", "birthday_bonus", "referral_bonus"];

// Daily job: sweep any earn transaction past its expires_at into a
// POINTS_EXPIRED reversal. Never deletes the original row — expiry_swept
// just marks it as accounted for so it's never summed twice. If a customer
// already spent down their balance below what these old rows represent
// (via redemptions), the expiry is capped at their current balance so it
// can never go negative — a documented simplification short of full FIFO
// consumption tracking per earn transaction.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: setting } = await supabase.from("app_settings").select("value").eq("key", "loyalty_points_expiry_months").maybeSingle();
  const expiryMonths = Number(setting?.value ?? 12);
  if (!expiryMonths || expiryMonths <= 0) return NextResponse.json({ enabled: false, processed: 0 });

  const nowIso = new Date().toISOString();
  const { data: dueRows } = await supabase
    .from("loyalty_transactions")
    .select("id, customer_id, points_delta")
    .eq("expiry_swept", false)
    .in("reason", EXPIRABLE_REASONS)
    .lt("expires_at", nowIso);

  if (!dueRows || dueRows.length === 0) return NextResponse.json({ enabled: true, processed: 0, results: [] });

  const byCustomer = new Map<number, { rowIds: number[]; total: number }>();
  for (const r of dueRows) {
    const cur = byCustomer.get(r.customer_id) || { rowIds: [], total: 0 };
    cur.rowIds.push(r.id);
    cur.total += Number(r.points_delta);
    byCustomer.set(r.customer_id, cur);
  }

  const results: { customer_id: number; expired: number }[] = [];
  for (const [customerId, { rowIds, total }] of byCustomer) {
    const { data: customer } = await supabase.from("customers").select("loyalty_points").eq("id", customerId).single();
    const currentBalance = Number(customer?.loyalty_points ?? 0);
    const expireAmount = Math.min(total, Math.max(0, currentBalance));

    if (expireAmount > 0) {
      await supabase.from("loyalty_transactions").insert({
        customer_id: customerId,
        points_delta: -expireAmount,
        reason: "points_expired",
        reference_type: "expiry_sweep",
      });
    }
    await supabase.from("loyalty_transactions").update({ expiry_swept: true }).in("id", rowIds);
    results.push({ customer_id: customerId, expired: expireAmount });
  }

  return NextResponse.json({ enabled: true, processed: results.length, results });
}
