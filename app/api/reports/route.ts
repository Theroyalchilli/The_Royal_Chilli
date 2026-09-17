import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const today = new Date().toISOString().slice(0, 10);
    const date = searchParams.get("date") || today;
    // from/to support a real range; date alone (back-compat) means a single day.
    const from = searchParams.get("from") || date;
    const to = searchParams.get("to") || date;

    const dayStart = from + "T00:00:00.000Z";
    const dayEnd = to + "T23:59:59.999Z";

    // Fetch all non-cancelled orders for the day
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, total, discount, status, order_type, created_at, customer_id")
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .not("status", "eq", "cancelled");

    if (ordersError) throw ordersError;

    const ordersData = orders ?? [];

    // Summary stats — revenue only counts orders actually paid. A Pay Later
    // order sits in this date range (it was placed that day) but hasn't
    // produced real money yet, so it must not inflate "revenue" — it shows
    // up separately via Staff Hub → Reports → Pending Bills instead. Order
    // *counts* still include it, since it genuinely was placed that day.
    const totalOrders = ordersData.length;
    const paidOrdersData = ordersData.filter((o) => o.status === "paid");
    const totalRevenue = paidOrdersData.reduce((s, o) => s + Number(o.total), 0);
    const avgOrderValue = paidOrdersData.length > 0 ? totalRevenue / paidOrdersData.length : 0;
    const paidOrders = paidOrdersData.length;

    const summary = {
      total_orders: totalOrders,
      total_revenue: Math.round(totalRevenue * 100) / 100,
      avg_order_value: Math.round(avgOrderValue * 100) / 100,
      paid_orders: paidOrders,
    };

    // Cancelled orders — excluded from every stat above by design, but worth
    // its own rate so a spike in cancellations doesn't hide inside "revenue looks fine".
    const { count: cancelledCount } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "cancelled")
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd);
    const totalOrdersIncCancelled = totalOrders + (cancelledCount ?? 0);
    const cancellation = {
      cancelled_count: cancelledCount ?? 0,
      cancellation_rate: totalOrdersIncCancelled > 0 ? Math.round(((cancelledCount ?? 0) / totalOrdersIncCancelled) * 1000) / 10 : 0,
    };

    // Discounts given — a straight sum of the discount field on these orders.
    const discountTotal = Math.round(ordersData.reduce((s, o) => s + Number(o.discount || 0), 0) * 100) / 100;

    // New vs returning customers — "returning" means they have an order before this range started.
    const customerIds = [...new Set(ordersData.map((o) => o.customer_id).filter((id): id is number => id != null))];
    let newCustomers = customerIds.length;
    let returningCustomers = 0;
    if (customerIds.length > 0) {
      const { data: priorOrders } = await supabase
        .from("orders")
        .select("customer_id")
        .in("customer_id", customerIds)
        .lt("created_at", dayStart);
      const returningSet = new Set((priorOrders ?? []).map((o) => o.customer_id));
      returningCustomers = returningSet.size;
      newCustomers = customerIds.length - returningCustomers;
    }
    const customers = { new: newCustomers, returning: returningCustomers };

    // By order type
    const byTypeMap: Record<string, { count: number; revenue: number }> = {};
    for (const o of ordersData) {
      if (!byTypeMap[o.order_type]) byTypeMap[o.order_type] = { count: 0, revenue: 0 };
      byTypeMap[o.order_type].count += 1;
      byTypeMap[o.order_type].revenue += Number(o.total);
    }
    const byType = Object.entries(byTypeMap).map(([order_type, v]) => ({
      order_type,
      count: v.count,
      revenue: Math.round(v.revenue * 100) / 100,
    }));

    // Hourly breakdown
    const hourlyMap: Record<string, { orders: number; revenue: number }> = {};
    for (const o of ordersData) {
      const hour = new Date(o.created_at).getUTCHours().toString().padStart(2, "0");
      if (!hourlyMap[hour]) hourlyMap[hour] = { orders: 0, revenue: 0 };
      hourlyMap[hour].orders += 1;
      hourlyMap[hour].revenue += Number(o.total);
    }
    const hourly = Object.entries(hourlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hour, v]) => ({
        hour,
        orders: v.orders,
        revenue: Math.round(v.revenue * 100) / 100,
      }));

    // Top items: fetch order_items for these orders
    const orderIds = ordersData.map((o) => o.id);
    let topItems: { item_name: string; quantity_sold: number; revenue: number }[] = [];
    let voidValue = 0;

    if (orderIds.length > 0) {
      const { data: orderItems, error: itemsError } = await supabase
        .from("order_items")
        .select("item_name, item_price, quantity, status")
        .in("order_id", orderIds);

      if (itemsError) throw itemsError;

      const itemMap: Record<string, { quantity_sold: number; revenue: number }> = {};
      for (const oi of orderItems ?? []) {
        const lineValue = Number(oi.item_price) * oi.quantity;
        if (oi.status === "cancelled") {
          voidValue += lineValue;
          continue; // a voided line was never actually sold — don't count it as a "top item"
        }
        if (!itemMap[oi.item_name]) itemMap[oi.item_name] = { quantity_sold: 0, revenue: 0 };
        itemMap[oi.item_name].quantity_sold += oi.quantity;
        itemMap[oi.item_name].revenue += lineValue;
      }
      topItems = Object.entries(itemMap)
        .map(([item_name, v]) => ({
          item_name,
          quantity_sold: v.quantity_sold,
          revenue: Math.round(v.revenue * 100) / 100,
        }))
        .sort((a, b) => b.quantity_sold - a.quantity_sold)
        .slice(0, 10);
      voidValue = Math.round(voidValue * 100) / 100;
    }

    // Payment split — keyed by which order the payment belongs to (i.e. the
    // day the order was placed), not by when the payment itself happened.
    // A Pay Later order paid off days later must still land back in the
    // original order's day here, not the day it was actually collected.
    let paymentSplit: { method: string; count: number; total: number }[] = [];
    if (orderIds.length > 0) {
      const { data: payments, error: paymentsError } = await supabase
        .from("payments")
        .select("method, amount, order_id")
        .in("order_id", orderIds);

      if (paymentsError) throw paymentsError;

      const payMap: Record<string, { count: number; total: number }> = {};
      for (const p of payments ?? []) {
        if (!payMap[p.method]) payMap[p.method] = { count: 0, total: 0 };
        payMap[p.method].count += 1;
        payMap[p.method].total += Number(p.amount);
      }
      paymentSplit = Object.entries(payMap).map(([method, v]) => ({
        method,
        count: v.count,
        total: Math.round(v.total * 100) / 100,
      }));
    }

    return NextResponse.json({
      date: to,
      from,
      to,
      summary,
      byType,
      topItems,
      paymentSplit,
      hourly,
      cancellation,
      discountTotal,
      voidValue,
      customers,
    });
  } catch (error) {
    console.error("Reports error:", error);
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 }
    );
  }
}
