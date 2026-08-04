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
    const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);

    const dayStart = date + "T00:00:00.000Z";
    const dayEnd = date + "T23:59:59.999Z";

    // Fetch all non-cancelled orders for the day
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, total, status, order_type, created_at")
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .not("status", "eq", "cancelled");

    if (ordersError) throw ordersError;

    const ordersData = orders ?? [];

    // Summary stats
    const totalOrders = ordersData.length;
    const totalRevenue = ordersData.reduce((s, o) => s + Number(o.total), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const paidOrders = ordersData.filter((o) => o.status === "paid").length;

    const summary = {
      total_orders: totalOrders,
      total_revenue: Math.round(totalRevenue * 100) / 100,
      avg_order_value: Math.round(avgOrderValue * 100) / 100,
      paid_orders: paidOrders,
    };

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

    if (orderIds.length > 0) {
      const { data: orderItems, error: itemsError } = await supabase
        .from("order_items")
        .select("item_name, item_price, quantity")
        .in("order_id", orderIds);

      if (itemsError) throw itemsError;

      const itemMap: Record<string, { quantity_sold: number; revenue: number }> = {};
      for (const oi of orderItems ?? []) {
        if (!itemMap[oi.item_name]) itemMap[oi.item_name] = { quantity_sold: 0, revenue: 0 };
        itemMap[oi.item_name].quantity_sold += oi.quantity;
        itemMap[oi.item_name].revenue += Number(oi.item_price) * oi.quantity;
      }
      topItems = Object.entries(itemMap)
        .map(([item_name, v]) => ({
          item_name,
          quantity_sold: v.quantity_sold,
          revenue: Math.round(v.revenue * 100) / 100,
        }))
        .sort((a, b) => b.quantity_sold - a.quantity_sold)
        .slice(0, 10);
    }

    // Payment split
    let paymentSplit: { method: string; count: number; total: number }[] = [];
    if (orderIds.length > 0) {
      const { data: payments, error: paymentsError } = await supabase
        .from("payments")
        .select("method, amount, created_at")
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd);

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
      date,
      summary,
      byType,
      topItems,
      paymentSplit,
      hourly,
    });
  } catch (error) {
    console.error("Reports error:", error);
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 }
    );
  }
}
