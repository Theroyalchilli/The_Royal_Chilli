"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface ReportData {
  date: string;
  summary: {
    total_orders: number;
    total_revenue: number;
    avg_order_value: number;
    paid_orders: number;
  };
  byType: Array<{ order_type: string; count: number; revenue: number }>;
  topItems: Array<{
    item_name: string;
    quantity_sold: number;
    revenue: number;
  }>;
  paymentSplit: Array<{ method: string; count: number; total: number }>;
  hourly: Array<{ hour: string; orders: number; revenue: number }>;
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  dine_in: "Dine-In",
  takeaway: "Takeaway",
  delivery: "Delivery",
};

const ORDER_TYPE_ICONS: Record<string, string> = {
  dine_in: "🍽️",
  takeaway: "🥡",
  delivery: "🛵",
};

interface WeekDay {
  date: string;
  label: string;
  revenue: number;
  orders: number;
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [chartView, setChartView] = useState<"today" | "week">("today");
  const [weekData, setWeekData] = useState<WeekDay[]>([]);
  const [weekLoading, setWeekLoading] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?date=${date}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to fetch reports", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [date]);

  const fetchWeekData = async () => {
    setWeekLoading(true);
    try {
      const days: WeekDay[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
        try {
          const res = await fetch(`/api/reports?date=${dateStr}`);
          const json = await res.json();
          days.push({
            date: dateStr,
            label,
            revenue: json?.summary?.total_revenue || 0,
            orders: json?.summary?.total_orders || 0,
          });
        } catch {
          days.push({ date: dateStr, label, revenue: 0, orders: 0 });
        }
      }
      setWeekData(days);
    } finally {
      setWeekLoading(false);
    }
  };

  useEffect(() => {
    if (chartView === "week") fetchWeekData();
  }, [chartView]);

  const handleExportCSV = () => {
    if (!data) return;
    const lines: string[] = [];

    // Summary section
    lines.push("DAILY SUMMARY");
    lines.push("Date,Total Orders,Total Revenue,Avg Order Value");
    lines.push(
      `${data.date},${data.summary.total_orders},${data.summary.total_revenue.toFixed(2)},${data.summary.avg_order_value.toFixed(2)}`
    );
    lines.push("");

    // Top Items section
    lines.push("TOP SELLING ITEMS");
    lines.push("Item Name,Quantity Sold,Revenue");
    for (const item of data.topItems) {
      lines.push(`"${item.item_name}",${item.quantity_sold},${item.revenue.toFixed(2)}`);
    }
    lines.push("");

    // Hourly section
    lines.push("HOURLY BREAKDOWN");
    lines.push("Hour,Orders,Revenue");
    for (const row of data.hourly) {
      lines.push(`${row.hour}:00,${row.orders},${row.revenue.toFixed(2)}`);
    }

    const csvContent = lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `royal-chilli-report-${data.date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Same 80mm-receipt-styled print pattern as the End of Day report — prints
  // on the till's receipt printer as a long strip, no separate report printer needed.
  const handlePrintReport = () => {
    if (!data) return;
    const dateLabel = new Date(data.date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const byTypeRows = data.byType
      .map((t) => `<div class="row"><span class="label">${ORDER_TYPE_LABELS[t.order_type] || t.order_type} (${t.count})</span><span class="value">£${t.revenue.toFixed(2)}</span></div>`)
      .join("");
    const paymentRows = data.paymentSplit
      .map((p) => `<div class="row"><span class="label">${p.method === "cash" ? "💵 Cash" : p.method === "card" ? "💳 Card" : p.method} (${p.count})</span><span class="value">£${p.total.toFixed(2)}</span></div>`)
      .join("");
    const topItemRows = data.topItems
      .slice(0, 10)
      .map((i, idx) => `<div class="row"><span class="label">${idx + 1}. ${i.item_name} ×${i.quantity_sold}</span><span class="value">£${i.revenue.toFixed(2)}</span></div>`)
      .join("");

    const html = `<!DOCTYPE html><html><head><title>Sales Report</title>
    <style>
      body { font-family: monospace; font-size: 12px; max-width: 300px; margin: 20px auto; color: #000; }
      h1 { text-align: center; font-size: 16px; margin-bottom: 4px; }
      h2 { font-size: 12px; margin: 12px 0 4px; text-transform: uppercase; }
      .sub { text-align: center; font-size: 11px; color: #555; margin-bottom: 16px; }
      .divider { border-top: 1px dashed #000; margin: 10px 0; }
      .row { display: flex; justify-content: space-between; margin: 3px 0; gap: 8px; }
      .label { color: #555; }
      .value { font-weight: bold; white-space: nowrap; }
      .total { font-size: 15px; font-weight: bold; }
      .footer { text-align: center; margin-top: 16px; font-size: 10px; color: #888; }
    </style></head><body>
    <h1>THE ROYAL CHILLI</h1>
    <div class="sub">43 Kingsley Road, Hounslow TW3 1PA</div>
    <div class="sub">SALES REPORT</div>
    <div class="sub">${dateLabel}</div>
    <div class="divider"></div>
    <div class="row"><span class="label">Total Orders</span><span class="value">${data.summary.total_orders}</span></div>
    <div class="row"><span class="label">Paid Orders</span><span class="value">${data.summary.paid_orders}</span></div>
    <div class="row"><span class="label">Avg Order Value</span><span class="value">£${data.summary.avg_order_value.toFixed(2)}</span></div>
    <div class="row"><span class="label">Total Revenue</span><span class="value total">£${data.summary.total_revenue.toFixed(2)}</span></div>
    <div class="divider"></div>
    <h2>By Order Type</h2>
    ${byTypeRows || '<div class="row"><span class="label">No orders</span></div>'}
    <div class="divider"></div>
    <h2>Payment Methods</h2>
    ${paymentRows || '<div class="row"><span class="label">No payments</span></div>'}
    <div class="divider"></div>
    <h2>Top Items</h2>
    ${topItemRows || '<div class="row"><span class="label">No items sold</span></div>'}
    <div class="footer">Printed by ${new Date().toLocaleTimeString("en-GB")} · Royal Chilli POS</div>
    </body></html>`;
    const w = window.open("", "_blank", "width=400,height=600");
    if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
  };

  const hourlyData = Array.from({ length: 24 }, (_, h) => {
    const hourStr = h.toString().padStart(2, "0");
    const found = data?.hourly.find((x) => x.hour === hourStr);
    return {
      hour: `${h}:00`,
      orders: found?.orders || 0,
      revenue: found?.revenue || 0,
    };
  }).filter((h) => {
    const hr = parseInt(h.hour);
    return hr >= 7 && hr <= 23;
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-surface border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <h1 className="text-foreground font-bold text-xl">Sales Reports</h1>
              <p className="text-muted-foreground text-xs">The Royal Chilli • Hounslow</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-surface-hover border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
            />
            <button
              onClick={fetchReports}
              className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Load
            </button>
            <button
              onClick={handleExportCSV}
              disabled={!data}
              className="px-3 py-2 bg-elevated hover:bg-elevated-hover disabled:opacity-40 text-foreground text-sm font-semibold rounded-lg transition-colors"
            >
              ⬇ Export CSV
            </button>
            <button
              onClick={handlePrintReport}
              disabled={!data}
              className="px-3 py-2 bg-elevated hover:bg-elevated-hover disabled:opacity-40 text-foreground text-sm font-semibold rounded-lg transition-colors"
            >
              🖨️ Print
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading ? (
          <div className="text-muted-foreground text-center mt-20 animate-pulse">
            Loading reports...
          </div>
        ) : !data ? (
          <div className="text-muted-foreground text-center mt-20">
            No data available
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-surface border border-border rounded-2xl p-5">
                <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-2">
                  Total Revenue
                </div>
                <div className="text-red-600 text-3xl font-bold">
                  {formatCurrency(data.summary.total_revenue)}
                </div>
                <div className="text-muted-foreground text-xs mt-1">
                  {date === new Date().toISOString().slice(0, 10) ? "Today" : date}
                </div>
              </div>
              <div className="bg-surface border border-border rounded-2xl p-5">
                <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-2">
                  Total Orders
                </div>
                <div className="text-blue-600 text-3xl font-bold">
                  {data.summary.total_orders}
                </div>
                <div className="text-muted-foreground text-xs mt-1">
                  {data.summary.paid_orders} paid
                </div>
              </div>
              <div className="bg-surface border border-border rounded-2xl p-5">
                <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-2">
                  Avg Order Value
                </div>
                <div className="text-green-600 text-3xl font-bold">
                  {formatCurrency(data.summary.avg_order_value)}
                </div>
                <div className="text-muted-foreground text-xs mt-1">per order</div>
              </div>
              <div className="bg-surface border border-border rounded-2xl p-5">
                <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-2">
                  Payment Split
                </div>
                <div className="space-y-1 mt-2">
                  {data.paymentSplit.map((p) => (
                    <div key={p.method} className="flex items-center justify-between">
                      <span className="text-foreground text-sm capitalize">
                        {p.method === "cash" ? "💵 Cash" : "💳 Card"}
                      </span>
                      <span className="text-foreground font-semibold text-sm">
                        {formatCurrency(p.total)}
                      </span>
                    </div>
                  ))}
                  {data.paymentSplit.length === 0 && (
                    <div className="text-muted-foreground text-sm">No payments yet</div>
                  )}
                </div>
              </div>
            </div>

            {/* By Order Type */}
            <div className="bg-surface border border-border rounded-2xl p-5">
              <h2 className="text-foreground font-bold text-base mb-4">
                Orders by Type
              </h2>
              <div className="grid grid-cols-3 gap-4">
                {["dine_in", "takeaway", "delivery"].map((type) => {
                  const found = data.byType.find((t) => t.order_type === type);
                  return (
                    <div
                      key={type}
                      className="bg-surface-hover rounded-xl p-4 text-center"
                    >
                      <div className="text-3xl mb-2">
                        {ORDER_TYPE_ICONS[type]}
                      </div>
                      <div className="text-foreground font-bold text-lg">
                        {found?.count || 0}
                      </div>
                      <div className="text-muted-foreground text-sm">
                        {ORDER_TYPE_LABELS[type]}
                      </div>
                      <div className="text-red-600 font-semibold text-sm mt-1">
                        {formatCurrency(found?.revenue || 0)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hourly Chart + Week Heatmap */}
            <div className="bg-surface border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-foreground font-bold text-base">
                  {chartView === "today" ? "Hourly Sales" : "This Week"}
                </h2>
                <div className="flex items-center gap-1 bg-surface-hover rounded-lg p-1">
                  <button
                    onClick={() => setChartView("today")}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                      chartView === "today"
                        ? "bg-red-600 text-white"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setChartView("week")}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                      chartView === "week"
                        ? "bg-red-600 text-white"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    This Week
                  </button>
                </div>
              </div>

              {chartView === "today" && (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlyData}>
                      <XAxis
                        dataKey="hour"
                        tick={{ fill: "#6b7280", fontSize: 11 }}
                        interval={1}
                      />
                      <YAxis
                        tick={{ fill: "#6b7280", fontSize: 11 }}
                        tickFormatter={(v) => `£${v}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1f2937",
                          border: "1px solid #374151",
                          borderRadius: "8px",
                          color: "#fff",
                        }}
                        formatter={(value: number) => [
                          formatCurrency(value),
                          "Revenue",
                        ]}
                      />
                      <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                        {hourlyData.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={entry.revenue > 0 ? "#f97316" : "#374151"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {chartView === "week" && (
                weekLoading ? (
                  <div className="text-muted-foreground text-center py-8 animate-pulse">Loading week data...</div>
                ) : (
                  <div className="overflow-x-auto">
                    {(() => {
                      const maxRevenue = Math.max(...weekData.map((d) => d.revenue), 1);
                      const busiestIdx = weekData.reduce(
                        (best, d, i) => (d.revenue > weekData[best].revenue ? i : best),
                        0
                      );
                      return (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-muted-foreground font-semibold text-left py-2 pr-4">Day</th>
                              <th className="text-muted-foreground font-semibold text-right py-2 pr-4">Orders</th>
                              <th className="text-muted-foreground font-semibold text-right py-2 pr-6">Revenue</th>
                              <th className="text-muted-foreground font-semibold text-left py-2">Bar</th>
                            </tr>
                          </thead>
                          <tbody>
                            {weekData.map((day, idx) => (
                              <tr
                                key={day.date}
                                className={`border-b border-border ${
                                  idx === busiestIdx ? "bg-red-500/10" : "hover:bg-surface-hover/40"
                                }`}
                              >
                                <td className="py-2 pr-4">
                                  <span className={`font-medium ${idx === busiestIdx ? "text-red-700" : "text-foreground"}`}>
                                    {day.label}
                                  </span>
                                  {idx === busiestIdx && (
                                    <span className="ml-2 text-[10px] font-bold text-red-600 bg-red-500/20 border border-red-500/30 px-1.5 py-0.5 rounded-full">
                                      Busiest
                                    </span>
                                  )}
                                </td>
                                <td className="text-foreground font-semibold text-right py-2 pr-4">{day.orders}</td>
                                <td className="text-red-600 font-semibold text-right py-2 pr-6">
                                  {formatCurrency(day.revenue)}
                                </td>
                                <td className="py-2 w-32">
                                  <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${idx === busiestIdx ? "bg-red-500" : "bg-red-700"}`}
                                      style={{ width: `${(day.revenue / maxRevenue) * 100}%` }}
                                    />
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                )
              )}
            </div>

            {/* Top Items */}
            <div className="bg-surface border border-border rounded-2xl p-5">
              <h2 className="text-foreground font-bold text-base mb-4">
                Top Selling Items
              </h2>
              {data.topItems.length === 0 ? (
                <div className="text-muted-foreground text-sm">No sales data yet</div>
              ) : (
                <div className="space-y-2">
                  {data.topItems.map((item, idx) => (
                    <div
                      key={item.item_name}
                      className="flex items-center gap-3 py-2"
                    >
                      <span className="text-muted-foreground font-bold text-sm w-6 text-center">
                        {idx + 1}
                      </span>
                      <div className="flex-1">
                        <div className="text-foreground text-sm font-medium">
                          {item.item_name}
                        </div>
                        <div className="h-1.5 bg-surface-hover rounded-full mt-1.5 overflow-hidden">
                          <div
                            className="h-full bg-red-500 rounded-full"
                            style={{
                              width: `${(item.quantity_sold / data.topItems[0].quantity_sold) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-foreground text-sm font-semibold">
                          {item.quantity_sold} sold
                        </div>
                        <div className="text-red-600 text-xs">
                          {formatCurrency(item.revenue)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Hourly breakdown table */}
            <div className="bg-surface border border-border rounded-2xl p-5">
              <h2 className="text-foreground font-bold text-base mb-4">
                Hourly Breakdown
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-muted-foreground font-semibold text-left py-2 pr-4">
                        Hour
                      </th>
                      <th className="text-muted-foreground font-semibold text-right py-2 pr-4">
                        Orders
                      </th>
                      <th className="text-muted-foreground font-semibold text-right py-2">
                        Revenue
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.hourly.map((row) => (
                      <tr
                        key={row.hour}
                        className="border-b border-border hover:bg-surface-hover/50"
                      >
                        <td className="text-foreground py-2 pr-4">{row.hour}:00</td>
                        <td className="text-foreground font-semibold text-right py-2 pr-4">
                          {row.orders}
                        </td>
                        <td className="text-red-600 font-semibold text-right py-2">
                          {formatCurrency(row.revenue)}
                        </td>
                      </tr>
                    ))}
                    {data.hourly.length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="text-muted-foreground text-center py-4"
                        >
                          No sales data for this date
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {data.hourly.length > 0 && (
                    <tfoot>
                      <tr className="border-t border-elevated">
                        <td className="text-foreground font-bold py-2 pr-4">
                          Total
                        </td>
                        <td className="text-foreground font-bold text-right py-2 pr-4">
                          {data.summary.total_orders}
                        </td>
                        <td className="text-red-600 font-bold text-right py-2">
                          {formatCurrency(data.summary.total_revenue)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer nav */}
      <div className="bg-surface border-t border-border px-6 py-3 flex gap-3">
        <Link
          href="/pos"
          className="px-4 py-2 bg-surface-hover hover:bg-elevated text-foreground text-sm font-semibold rounded-lg border border-border transition-colors"
        >
          ← Back to POS
        </Link>
        <Link
          href="/pos/kitchen"
          className="px-4 py-2 bg-surface-hover hover:bg-elevated text-foreground text-sm font-semibold rounded-lg border border-border transition-colors"
        >
          🍳 Kitchen
        </Link>
        <Link
          href="/pos/reservations"
          className="px-4 py-2 bg-surface-hover hover:bg-elevated text-foreground text-sm font-semibold rounded-lg border border-border transition-colors"
        >
          📅 Reservations
        </Link>
      </div>
    </div>
  );
}
