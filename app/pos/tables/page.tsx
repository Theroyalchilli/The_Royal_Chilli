"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { RestaurantTable } from "@/lib/types";

const statusConfig = {
  available: {
    label: "Available",
    color: "bg-green-900/40 border-green-600 text-green-300",
    dot: "bg-green-500",
  },
  occupied: {
    label: "Occupied",
    color: "bg-red-900/40 border-red-600 text-red-300",
    dot: "bg-red-500",
  },
  reserved: {
    label: "Reserved",
    color: "bg-yellow-900/40 border-yellow-600 text-yellow-300",
    dot: "bg-yellow-500",
  },
};

export default function TablesPage() {
  const router = useRouter();
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTables = async () => {
    try {
      const res = await fetch("/api/tables");
      const data = await res.json();
      setTables(data.tables || []);
    } catch (err) {
      console.error("Failed to fetch tables", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
    const interval = setInterval(fetchTables, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await fetch("/api/tables", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      fetchTables();
    } catch (err) {
      console.error("Failed to update table", err);
    }
  };

  const groups = {
    main: tables.filter((t) => t.location === "main"),
    outdoor: tables.filter((t) => t.location === "outdoor"),
    private: tables.filter((t) => t.location === "private"),
  };

  const summary = {
    available: tables.filter((t) => t.status === "available").length,
    occupied: tables.filter((t) => t.status === "occupied").length,
    reserved: tables.filter((t) => t.status === "reserved").length,
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🍽️</span>
            <div>
              <h1 className="text-white font-bold text-xl">Table Management</h1>
              <p className="text-gray-400 text-xs">The Royal Chilli • Hounslow</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Summary badges */}
            <div className="flex gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-green-400 text-sm">{summary.available} Free</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-red-400 text-sm">{summary.occupied} Occupied</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-yellow-400 text-sm">{summary.reserved} Reserved</span>
              </div>
            </div>
            <button
              onClick={fetchTables}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-lg border border-gray-700 transition-colors"
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6">
        {loading ? (
          <div className="text-gray-400 text-center mt-20 animate-pulse">
            Loading tables...
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groups).map(([loc, locTables]) => {
              if (locTables.length === 0) return null;
              return (
                <div key={loc}>
                  <h2 className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-3">
                    {loc === "main" ? "Main Floor" : loc === "outdoor" ? "Outdoor" : "Private Room"}
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {locTables.map((table) => {
                      const cfg = statusConfig[table.status];
                      return (
                        <div
                          key={table.id}
                          className={`rounded-2xl border-2 p-5 ${cfg.color} transition-all`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-2xl font-black">{table.table_number}</span>
                            <span className={`w-3 h-3 rounded-full ${cfg.dot}`} />
                          </div>
                          <div className="text-sm font-semibold mb-1">{cfg.label}</div>
                          <div className="text-xs opacity-70 mb-3">{table.capacity} seats</div>

                          {/* Status toggle buttons */}
                          <div className="space-y-1.5">
                            {table.status !== "available" && (
                              <button
                                onClick={() => handleStatusChange(table.id, "available")}
                                className="w-full py-1.5 bg-green-700/50 hover:bg-green-700 text-green-200 text-xs font-semibold rounded-lg transition-colors no-select pos-btn"
                              >
                                Set Free
                              </button>
                            )}
                            {table.status !== "occupied" && (
                              <button
                                onClick={() => handleStatusChange(table.id, "occupied")}
                                className="w-full py-1.5 bg-red-700/50 hover:bg-red-700 text-red-200 text-xs font-semibold rounded-lg transition-colors no-select pos-btn"
                              >
                                Set Occupied
                              </button>
                            )}
                            {table.status !== "reserved" && (
                              <button
                                onClick={() => handleStatusChange(table.id, "reserved")}
                                className="w-full py-1.5 bg-yellow-700/50 hover:bg-yellow-700 text-yellow-200 text-xs font-semibold rounded-lg transition-colors no-select pos-btn"
                              >
                                Reserve
                              </button>
                            )}
                            <button
                              onClick={() => router.push("/pos")}
                              className="w-full py-1.5 bg-orange-700/50 hover:bg-orange-700 text-orange-200 text-xs font-semibold rounded-lg transition-colors no-select pos-btn"
                            >
                              New Order →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
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
          🍳 Kitchen Display
        </Link>
      </div>
    </div>
  );
}
