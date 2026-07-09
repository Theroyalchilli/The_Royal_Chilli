"use client";

import { useState, useEffect, useCallback } from "react";
import { getTimeElapsed } from "@/lib/utils";
import type { Order, OrderItem } from "@/lib/types";

interface OrderWithItems extends Order {
  items: OrderItem[];
}

export default function KitchenBoard() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/kitchen");
      const data = await res.json();
      setOrders(data.orders || []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Failed to fetch kitchen orders", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleStatusUpdate = async (orderId: number, status: string) => {
    try {
      await fetch("/api/kitchen", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status }),
      });
      fetchOrders();
    } catch (err) {
      console.error("Failed to update order status", err);
    }
  };

  const orderTypeIcon: Record<string, string> = {
    dine_in: "🍽️",
    takeaway: "🥡",
    delivery: "🛵",
  };

  const statusClass: Record<string, string> = {
    sent_to_kitchen:
      "border-yellow-500 bg-yellow-900/20 kitchen-new",
    ready: "border-green-500 bg-green-900/20",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400 text-xl animate-pulse">
          Loading kitchen orders...
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🍳</span>
          <div>
            <h1 className="text-white font-bold text-xl">Kitchen Display</h1>
            <p className="text-gray-400 text-xs">The Royal Chilli</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" />
            <span className="text-yellow-400 text-sm font-medium">
              New: {orders.filter((o) => o.status === "sent_to_kitchen").length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
            <span className="text-green-400 text-sm font-medium">
              Ready: {orders.filter((o) => o.status === "ready").length}
            </span>
          </div>
          <div className="text-gray-500 text-xs">
            Refreshes every 10s • Last:{" "}
            {lastRefresh.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </div>
          <button
            onClick={fetchOrders}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-lg border border-gray-700 transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-600">
            <span className="text-6xl">✅</span>
            <p className="text-xl font-semibold">All caught up!</p>
            <p className="text-sm">No pending kitchen orders</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className={`rounded-xl border-2 p-4 transition-all ${statusClass[order.status] || "border-gray-600 bg-gray-800"}`}
              >
                {/* Card Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-white font-bold text-lg">
                      {order.order_number}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-base">
                        {orderTypeIcon[order.order_type]}
                      </span>
                      <span className="text-gray-300 text-sm font-medium capitalize">
                        {order.order_type.replace("_", " ")}
                      </span>
                      {order.table_number && (
                        <span className="bg-gray-700 text-gray-300 text-xs px-1.5 py-0.5 rounded">
                          {order.table_number}
                        </span>
                      )}
                    </div>
                    {order.customer_name && (
                      <div className="text-gray-400 text-xs mt-1">
                        {order.customer_name}
                        {order.customer_phone && ` • ${order.customer_phone}`}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-xs font-bold px-2 py-1 rounded-full ${
                        order.status === "sent_to_kitchen"
                          ? "bg-yellow-600/30 text-yellow-400"
                          : "bg-green-600/30 text-green-400"
                      }`}
                    >
                      {order.status === "sent_to_kitchen" ? "NEW" : "READY"}
                    </div>
                    <div className="text-gray-500 text-xs mt-1">
                      {getTimeElapsed(order.created_at)}
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div className="border-t border-gray-700 pt-3 space-y-1.5">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-start gap-2">
                      <span
                        className={`flex-shrink-0 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                          item.status === "ready"
                            ? "bg-green-600 text-white"
                            : item.status === "preparing"
                            ? "bg-orange-600 text-white"
                            : "bg-gray-700 text-gray-300"
                        }`}
                      >
                        {item.quantity}
                      </span>
                      <div className="flex-1">
                        <div className="text-white text-sm font-medium leading-tight">
                          {item.item_name}
                        </div>
                        {item.notes && (
                          <div className="text-yellow-400 text-xs italic">
                            ⚠ {item.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Notes */}
                {order.notes && (
                  <div className="mt-2 bg-yellow-900/30 border border-yellow-700 rounded-lg px-2 py-1.5 text-yellow-300 text-xs">
                    📝 {order.notes}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-3 space-y-2">
                  {order.status === "sent_to_kitchen" && (
                    <button
                      onClick={() => handleStatusUpdate(order.id, "ready")}
                      className="pos-btn no-select w-full py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg text-sm transition-colors"
                    >
                      ✓ Mark Ready
                    </button>
                  )}
                  {order.status === "ready" && (
                    <div className="bg-green-900/20 border border-green-700/50 rounded-lg px-3 py-2 text-center">
                      <p className="text-green-300 text-xs font-semibold">✓ Food is Ready</p>
                      <p className="text-gray-500 text-[10px] mt-0.5">Cashier collects payment at POS</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
