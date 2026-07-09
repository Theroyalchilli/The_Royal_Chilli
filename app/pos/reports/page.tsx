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

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);

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
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <h1 className="text-white font-bold text-xl">Sales Reports</h1>
              <p className="text-gray-400 text-xs">The Royal Chilli • Hounslow</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
            />
            <button
              onClick={fetchReports}
              className="px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Load
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading ? (
          <div className="text-gray-400 text-center mt-20 animate-pulse">
            Loading reports...
          </div>
        ) : !data ? (
          <div className="text-gray-400 text-center mt-20">
            No data available
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">
                  Total Revenue
                </div>
                <div className="text-orange-400 text-3xl font-bold">
                  {formatCurrency(data.summary.total_revenue)}
                </div>
                <div className="text-gray-500 text-xs mt-1">
                  {date === new Date().toISOString().slice(0, 10) ? "Today" : date}
                </div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">
                  Total Orders
                </div>
                <div className="text-blue-400 text-3xl font-bold">
                  {data.summary.total_orders}
                </div>
                <div className="text-gray-500 text-xs mt-1">
                  {data.summary.paid_orders} paid
                </div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">
                  Avg Order Value
                </div>
                <div className="text-green-400 text-3xl font-bold">
                  {formatCurrency(data.summary.avg_order_value)}
                </div>
                <div className="text-gray-500 text-xs mt-1">per order</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">
                  Payment Split
                </div>
                <div className="space-y-1 mt-2">
                  {data.paymentSplit.map((p) => (
                    <div key={p.method} className="flex items-center justify-between">
                      <span className="text-gray-300 text-sm capitalize">
                        {p.method === "cash" ? "💵 Cash" : "💳 Card"}
                      </span>
                      <span className="text-white font-semibold text-sm">
                        {formatCurrency(p.total)}
                      </span>
                    </div>
                  ))}
                  {data.paymentSplit.length === 0 && (
                    <div className="text-gray-600 text-sm">No payments yet</div>
                  )}
                </div>
              </div>
            </div>

            {/* By Order Type */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h2 className="text-white font-bold text-base mb-4">
                Orders by Type
              </h2>
              <div className="grid grid-cols-3 gap-4">
                {["dine_in", "takeaway", "delivery"].map((type) => {
                  const found = data.byType.find((t) => t.order_type === type);
                  return (
                    <div
                      key={type}
                      className="bg-gray-800 rounded-xl p-4 text-center"
                    >
                      <div className="text-3xl mb-2">
                        {ORDER_TYPE_ICONS[type]}
                      </div>
                      <div className="text-white font-bold text-lg">
                        {found?.count || 0}
                      </div>
                      <div className="text-gray-400 text-sm">
                        {ORDER_TYPE_LABELS[type]}
                      </div>
                      <div className="text-orange-400 font-semibold text-sm mt-1">
                        {formatCurrency(found?.revenue || 0)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hourly Chart */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h2 className="text-white font-bold text-base mb-4">
                Hourly Sales
              </h2>
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
            </div>

            {/* Top Items */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h2 className="text-white font-bold text-base mb-4">
                Top Selling Items
              </h2>
              {data.topItems.length === 0 ? (
                <div className="text-gray-500 text-sm">No sales data yet</div>
              ) : (
                <div className="space-y-2">
                  {data.topItems.map((item, idx) => (
                    <div
                      key={item.item_name}
                      className="flex items-center gap-3 py-2"
                    >
                      <span className="text-gray-500 font-bold text-sm w-6 text-center">
                        {idx + 1}
                      </span>
                      <div className="flex-1">
                        <div className="text-white text-sm font-medium">
                          {item.item_name}
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded-full mt-1.5 overflow-hidden">
                          <div
                            className="h-full bg-orange-500 rounded-full"
                            style={{
                              width: `${(item.quantity_sold / data.topItems[0].quantity_sold) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white text-sm font-semibold">
                          {item.quantity_sold} sold
                        </div>
                        <div className="text-orange-400 text-xs">
                          {formatCurrency(item.revenue)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Hourly breakdown table */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h2 className="text-white font-bold text-base mb-4">
                Hourly Breakdown
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-gray-400 font-semibold text-left py-2 pr-4">
                        Hour
                      </th>
                      <th className="text-gray-400 font-semibold text-right py-2 pr-4">
                        Orders
                      </th>
                      <th className="text-gray-400 font-semibold text-right py-2">
                        Revenue
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.hourly.map((row) => (
                      <tr
                        key={row.hour}
                        className="border-b border-gray-800 hover:bg-gray-800/50"
                      >
                        <td className="text-gray-300 py-2 pr-4">{row.hour}:00</td>
                        <td className="text-white font-semibold text-right py-2 pr-4">
                          {row.orders}
                        </td>
                        <td className="text-orange-400 font-semibold text-right py-2">
                          {formatCurrency(row.revenue)}
                        </td>
                      </tr>
                    ))}
                    {data.hourly.length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="text-gray-500 text-center py-4"
                        >
                          No sales data for this date
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {data.hourly.length > 0 && (
                    <tfoot>
                      <tr className="border-t border-gray-600">
                        <td className="text-white font-bold py-2 pr-4">
                          Total
                        </td>
                        <td className="text-white font-bold text-right py-2 pr-4">
                          {data.summary.total_orders}
                        </td>
                        <td className="text-orange-400 font-bold text-right py-2">
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
      <div className="bg-gray-900 border-t border-gray-800 px-6 py-3 flex gap-3">
        <Link
          href="/pos"
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-semibold rounded-lg border border-gray-700 transition-colors"
        >
          ← Back to POS
        </Link>
        <Link
          href="/pos/kitchen"
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-semibold rounded-lg border border-gray-700 transition-colors"
        >
          🍳 Kitchen
        </Link>
        <Link
          href="/pos/tables"
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-semibold rounded-lg border border-gray-700 transition-colors"
        >
          🍽️ Tables
        </Link>
      </div>
    </div>
  );
}
