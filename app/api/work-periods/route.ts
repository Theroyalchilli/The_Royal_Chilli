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

  // Pending Bills — orders from *this specific till shift* marked Pay Later
  // and still not fully paid off. Scoped to work_period_id, not calendar
  // date, since a late-night shift can run past midnight.
  let pendingBills: { order_number: string; total: number; customer_name: string | null }[] = [];
  let pendingBillsTotal = 0;
  if (period?.id) {
    const { data: pending } = await supabase
      .from("orders")
      .select("order_number, total, amount_paid, customer_name")
      .eq("work_period_id", period.id)
      .eq("pay_later", true)
      .not("status", "eq", "cancelled")
      .not("status", "eq", "paid");
    pendingBills = (pending || []).map((o) => ({
      order_number: o.order_number,
      total: Number(o.total) - Number(o.amount_paid),
      customer_name: o.customer_name,
    }));
    pendingBillsTotal = Math.round(pendingBills.reduce((s, o) => s + o.total, 0) * 100) / 100;
  }

  // Collected — actual money received during THIS shift, regardless of which
  // day/shift the underlying order was placed under. Different question from
  // Sales above ("how much did we trade") — this is "what should physically
  // be in the drawer + terminal right now", so it must include a Pay Later
  // order from an earlier, already-closed shift being settled just now.
  let collectedOwn = 0;
  let collectedPriorTotal = 0;
  let collectedCash = 0;
  let collectedCard = 0;
  const priorSettlements: { order_number: string; order_type: string | null; order_date: string | null; amount: number }[] = [];

  if (period?.id) {
    const { data: periodPayments } = await supabase
      .from("payments")
      .select("amount, method, order_id")
      .gte("created_at", period.opened_at)
      .lte("created_at", new Date().toISOString());

    const pays = periodPayments || [];
    const payOrderIds = [...new Set(pays.map((p) => p.order_id))];
    const orderById: Record<number, { order_number: string; order_type: string; work_period_id: number | null; created_at: string }> = {};
    if (payOrderIds.length > 0) {
      const { data: relatedOrders } = await supabase
        .from("orders")
        .select("id, order_number, order_type, work_period_id, created_at")
        .in("id", payOrderIds);
      for (const o of relatedOrders || []) orderById[o.id] = o;
    }

    for (const p of pays) {
      const amt = Number(p.amount);
      if (p.method === "cash") collectedCash += amt; else collectedCard += amt;
      const o = orderById[p.order_id];
      if (o && o.work_period_id === period.id) {
        collectedOwn += amt;
      } else {
        collectedPriorTotal += amt;
        priorSettlements.push({
          order_number: o?.order_number ?? `#${p.order_id}`,
          order_type: o?.order_type ?? null,
          order_date: o?.created_at ?? null,
          amount: Math.round(amt * 100) / 100,
        });
      }
    }
  }

  // Cash Paid Out — cash physically removed from the till during this shift
  // (a driver tip, petty cash for supplies) — subtracted from Expected Cash.
  let cashPaidOutTotal = 0;
  let cashPaidOuts: { amount: number; reason: string; created_at: string }[] = [];
  if (period?.id) {
    const { data: paidOuts } = await supabase
      .from("cash_paid_outs")
      .select("amount, reason, created_at")
      .eq("work_period_id", period.id);
    cashPaidOuts = (paidOuts || []).map((p) => ({ amount: Number(p.amount), reason: p.reason, created_at: p.created_at }));
    cashPaidOutTotal = Math.round(cashPaidOuts.reduce((s, p) => s + p.amount, 0) * 100) / 100;
  }

  // Unpaid Orders — every currently-unpaid order for this shift, one
  // itemized list covering both ordinary in-progress orders and ones
  // explicitly marked Pay Later, replacing a bare count with something
  // staff can actually act on at close-of-day.
  let unpaidOrders: { order_number: string; total: number; amount_paid: number; status: string; pay_later: boolean }[] = [];

  // Discounts + Refunds — against orders belonging to THIS period
  // specifically, whenever the refund itself happens, mirroring how Sales
  // already only cares about the order's own period, not payment timing.
  let discountTotal = 0;
  let refundsTotal = 0;
  let refunds: { order_number: string; amount: number; created_at: string }[] = [];

  if (period?.id) {
    const { data: periodOrders } = await supabase
      .from("orders")
      .select("id, order_number, total, amount_paid, discount, status, pay_later")
      .eq("work_period_id", period.id);

    for (const o of periodOrders || []) {
      if (o.status !== "paid" && o.status !== "cancelled") {
        unpaidOrders.push({
          order_number: o.order_number,
          total: Number(o.total),
          amount_paid: Number(o.amount_paid),
          status: o.status,
          pay_later: o.pay_later,
        });
      }
      if (o.status === "paid") discountTotal += Number(o.discount || 0);
    }
    discountTotal = Math.round(discountTotal * 100) / 100;

    const periodOrderIds = (periodOrders || []).map((o) => o.id);
    const orderNumberById: Record<number, string> = Object.fromEntries((periodOrders || []).map((o) => [o.id, o.order_number]));
    if (periodOrderIds.length > 0) {
      const { data: refundPayments } = await supabase
        .from("payments")
        .select("amount, order_id, created_at")
        .in("order_id", periodOrderIds)
        .lt("amount", 0);
      for (const p of refundPayments || []) {
        refunds.push({
          order_number: orderNumberById[p.order_id] ?? `#${p.order_id}`,
          amount: Math.round(Number(p.amount) * 100) / 100,
          created_at: p.created_at,
        });
      }
      refundsTotal = Math.round(refunds.reduce((s, r) => s + r.amount, 0) * 100) / 100;
    }
  }

  return NextResponse.json({
    period,
    summary: {
      total_revenue: Math.round(totalRevenue * 100) / 100,
      net_sales: Math.round((totalRevenue + refundsTotal) * 100) / 100,
      discount_total: discountTotal,
      refunds_total: refundsTotal,
      refunds,
      total_orders: totalOrders,
      cash_total: Math.round(cashTotal * 100) / 100,
      card_total: Math.round(cardTotal * 100) / 100,
      open_orders: openOrdersCount || 0,
      pending_bills_total: pendingBillsTotal,
      pending_bills: pendingBills,
      unpaid_orders: unpaidOrders,
      cash_paid_out_total: cashPaidOutTotal,
      cash_paid_outs: cashPaidOuts,
      collected: {
        own_total: Math.round(collectedOwn * 100) / 100,
        prior_total: Math.round(collectedPriorTotal * 100) / 100,
        total: Math.round((collectedOwn + collectedPriorTotal) * 100) / 100,
        cash_total: Math.round(collectedCash * 100) / 100,
        card_total: Math.round(collectedCard * 100) / 100,
        prior_settlements: priorSettlements,
      },
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
