import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";

// GET — return the current open work period with today's revenue summary
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch the open work period
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

  // Today's date range
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // Fetch today's paid orders
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, total")
    .eq("status", "paid")
    .gte("created_at", todayStart.toISOString())
    .lte("created_at", todayEnd.toISOString());

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 });
  }

  const orderIds = (orders || []).map((o) => o.id);
  const totalRevenue = (orders || []).reduce((sum, o) => sum + (o.total || 0), 0);
  const totalOrders = (orders || []).length;

  // Fetch payments for today's orders to get cash/card split
  let cashTotal = 0;
  let cardTotal = 0;

  if (orderIds.length > 0) {
    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select("method, amount")
      .in("order_id", orderIds);

    if (!paymentsError && payments) {
      for (const p of payments) {
        if (p.method === "cash") cashTotal += p.amount || 0;
        else cardTotal += p.amount || 0;
      }
    }
  }

  // Count open (unpaid) orders
  const { count: openOrdersCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "sent_to_kitchen", "ready"]);

  return NextResponse.json({
    period,
    summary: {
      total_revenue: Math.round(totalRevenue * 100) / 100,
      total_orders: totalOrders,
      cash_total: Math.round(cashTotal * 100) / 100,
      card_total: Math.round(cardTotal * 100) / 100,
      open_orders: openOrdersCount || 0,
    },
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
  const { closing_cash, opening_cash, staff_id } = body;

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

  const { data: updated, error: updateError } = await supabase
    .from("work_periods")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closing_cash: closing_cash ?? null,
      closed_by: staff_id ?? session.id,
    })
    .eq("id", period.id)
    .select()
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ period: updated });
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
