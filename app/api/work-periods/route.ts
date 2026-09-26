import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { calculateZReport, snapshotZReport } from "@/lib/z-report-db";

// GET — the current open work period plus its live Z report (lib/z-report.ts),
// which the End of Day screen shows before closing.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: period, error: periodError } = await supabase
    .from("work_periods")
    .select("*")
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (periodError) {
    return NextResponse.json({ error: periodError.message }, { status: 500 });
  }

  const report = period ? await calculateZReport(period.id) : null;
  return NextResponse.json({
    period: period ? { ...period, opened_by_name: report?.opened_by_name ?? null } : period,
    report,
  });
}

// PUT — close the current open work period. If none is open (the till was
// never explicitly "opened"), one is created retroactively backdated to the
// start of today, and today's orders that predate it get linked to it, so
// closing the day is a single action — no separate "open" step required.
export async function PUT(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { closing_cash, opening_cash, staff_id, close_note } = body;

  let { data: period, error: findError } = await supabase
    .from("work_periods")
    .select("id")
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });

  if (!period) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: created, error: createError } = await supabase
      .from("work_periods")
      .insert({
        opened_by: staff_id ?? session.id,
        opened_at: todayStart.toISOString(),
        opening_cash: opening_cash ?? 0,
        status: "open",
      })
      .select("id")
      .single();

    if (createError) return NextResponse.json({ error: createError.message }, { status: 500 });
    period = created;

    // Backfill today's orders that predate this period so cash reconciliation
    // reports pick them up.
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    await supabase
      .from("orders")
      .update({ work_period_id: period.id })
      .is("work_period_id", null)
      .gte("created_at", todayStart.toISOString())
      .lte("created_at", todayEnd.toISOString());
  }

  // Every order this shift must be resolved to paid, cancelled, or
  // explicitly Pay Later before the day can close — no leaving one just
  // sitting there unpaid and unaccounted for. Checked server-side, not just
  // in the UI, since this is the one thing Close Day must never skip.
  const { data: unresolved, error: unresolvedError } = await supabase
    .from("orders")
    .select("order_number")
    .eq("work_period_id", period.id)
    .not("status", "eq", "paid")
    .not("status", "eq", "cancelled")
    .eq("pay_later", false);
  if (unresolvedError) return NextResponse.json({ error: unresolvedError.message }, { status: 500 });
  if ((unresolved || []).length > 0) {
    return NextResponse.json(
      {
        error: `${unresolved.length} order${unresolved.length > 1 ? "s" : ""} still need${unresolved.length > 1 ? "" : "s"} to be paid or marked Pay Later before closing: ${unresolved.map((o) => o.order_number).join(", ")}`,
      },
      { status: 400 }
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from("work_periods")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closing_cash: closing_cash ?? null,
      closed_by: staff_id ?? session.id,
      close_note: close_note?.trim() || null,
    })
    .eq("id", period.id)
    .select()
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Freeze the Z report as it stands at close, so a reprint later shows the
  // same figures. The day is already closed — a failure here only means a
  // reprint falls back to calculating live, so it's logged, not returned.
  let report = null;
  try {
    report = await snapshotZReport(period.id);
  } catch (err) {
    console.error(`Failed to snapshot Z report for work period ${period.id}:`, err);
  }

  return NextResponse.json({ period: updated, report });
}

// POST — open a new work period
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { opening_cash, staff_id } = body;

  const { data: newPeriod, error } = await supabase
    .from("work_periods")
    .insert({
      opened_by: staff_id ?? session.id,
      opened_at: new Date().toISOString(),
      opening_cash: opening_cash ?? 0,
      status: "open",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ period: newPeriod });
}
