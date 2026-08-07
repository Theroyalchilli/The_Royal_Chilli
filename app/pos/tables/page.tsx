"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { RestaurantTable } from "@/lib/types";
import { TABLE_ATTENTION_MINUTES, minutesSince, tableElapsedLabel } from "@/lib/utils";

const tableStatusCfg = {
  available: { label: "Available", color: "bg-green-100 border-green-300 text-green-700", dot: "bg-green-500", ring: "ring-green-500" },
  occupied:  { label: "Occupied",  color: "bg-red-100 border-red-300 text-red-700",       dot: "bg-red-500",   ring: "ring-red-500"   },
  reserved:  { label: "Reserved",  color: "bg-yellow-100 border-yellow-300 text-yellow-700", dot: "bg-yellow-500", ring: "ring-yellow-500" },
  attention: { label: "Needs Attention", color: "bg-orange-100 border-orange-400 text-orange-800", dot: "bg-orange-600", ring: "ring-orange-500" },
};

const resvStatusCfg: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: "Pending",   color: "text-yellow-700", bg: "bg-yellow-500/10 border-yellow-500/40" },
  confirmed: { label: "Confirmed", color: "text-blue-700",   bg: "bg-blue-500/10 border-blue-500/40"    },
  seated:    { label: "Seated",    color: "text-emerald-700",bg: "bg-emerald-500/10 border-emerald-500/40" },
  cancelled: { label: "Cancelled", color: "text-red-700",    bg: "bg-red-50 border-red-300"      },
  no_show:   { label: "No Show",   color: "text-muted-foreground",   bg: "bg-surface-hover/60 border-border"       },
  waitlisted:{ label: "Waitlisted",color: "text-purple-700",  bg: "bg-purple-500/10 border-purple-500/40" },
};

interface TableRequest {
  id: number;
  type: "waiter" | "bill";
  table_number: string | null;
  created_at: string;
}

interface Reservation {
  id: number;
  customer_name: string;
  customer_phone?: string;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  table_number?: string;
  table_id?: number;
  notes?: string;
  status: string;
  source?: string;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtTime(t: string) {
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

// ── Table Picker Modal ────────────────────────────────────────────────────────
function TablePickerModal({
  reservation,
  tables,
  onConfirm,
  onClose,
}: {
  reservation: Reservation;
  tables: RestaurantTable[];
  onConfirm: (tableId: number) => Promise<void>;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(reservation.table_id ?? null);
  const [saving, setSaving] = useState(false);

  const groups = {
    main:    tables.filter(t => t.location === "main"),
    outdoor: tables.filter(t => t.location === "outdoor"),
    private: tables.filter(t => t.location === "private"),
  };

  const handleSeat = async () => {
    if (!selected) return;
    setSaving(true);
    await onConfirm(selected);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-foreground font-bold text-lg">Allocate Table</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            {reservation.customer_name} · {fmtTime(reservation.reservation_time)} · 👥 {reservation.party_size} guests
          </p>
        </div>

        {/* Legend */}
        <div className="px-5 pt-3 flex gap-4">
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /><span className="text-green-700 text-xs">Available</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /><span className="text-red-700 text-xs">Occupied</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /><span className="text-yellow-700 text-xs">Reserved</span></div>
        </div>

        {/* Table grid */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-5">
          {Object.entries(groups).map(([loc, locTables]) => {
            if (locTables.length === 0) return null;
            const locLabel = loc === "main" ? "Main Floor" : loc === "outdoor" ? "Outdoor" : "Private Room";
            return (
              <div key={loc}>
                <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mb-2">{locLabel}</p>
                <div className="grid grid-cols-4 gap-2">
                  {locTables.map(table => {
                    const cfg = tableStatusCfg[table.status];
                    const isSelected = selected === table.id;
                    const isUnavailable = table.status === "occupied";
                    return (
                      <button
                        key={table.id}
                        disabled={isUnavailable}
                        onClick={() => setSelected(isSelected ? null : table.id)}
                        className={[
                          "rounded-xl border-2 p-3 text-center transition-all",
                          isUnavailable ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:scale-105",
                          isSelected
                            ? `${cfg.color} ring-2 ${cfg.ring} ring-offset-1 ring-offset-background scale-105`
                            : cfg.color,
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-lg font-black">{table.table_number}</span>
                          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                        </div>
                        <div className="text-[10px] opacity-70">{table.capacity} seats</div>
                        {isSelected && <div className="text-[10px] font-bold mt-1">✓ Selected</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Seat size hint */}
        {selected && (() => {
          const t = tables.find(t => t.id === selected);
          const fits = t && t.capacity >= reservation.party_size;
          return !fits ? (
            <div className="mx-5 mb-2 text-xs text-amber-700 bg-amber-100 border border-amber-300/40 rounded-lg px-3 py-2">
              ⚠️ Table {t?.table_number} seats {t?.capacity} — party is {reservation.party_size}. Confirm anyway?
            </div>
          ) : null;
        })()}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex gap-3">
          <button onClick={onClose}
            className="flex-1 h-11 bg-elevated hover:bg-elevated-hover border border-elevated text-foreground font-semibold rounded-xl transition-all">
            Cancel
          </button>
          <button
            onClick={handleSeat}
            disabled={!selected || saving}
            className="flex-1 h-11 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white font-bold rounded-xl transition-all"
          >
            {saving ? "Seating…" : selected ? `🪑 Seat at Table ${tables.find(t => t.id === selected)?.table_number}` : "Select a Table"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TablesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"tables" | "reservations">("tables");

  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [resvLoading, setResvLoading] = useState(true);
  const [resvDate, setResvDate] = useState(todayStr());
  const [updating, setUpdating] = useState<number | null>(null);

  // Table picker modal
  const [seatResv, setSeatResv] = useState<Reservation | null>(null);

  const [tableRequests, setTableRequests] = useState<TableRequest[]>([]);
  const fetchTableRequests = useCallback(async () => {
    const res = await fetch("/api/table-requests");
    const data = await res.json();
    setTableRequests(data.requests || []);
  }, []);
  const resolveTableRequest = async (id: number) => {
    await fetch("/api/table-requests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    fetchTableRequests();
  };

  const fetchTables = useCallback(async () => {
    try {
      const res = await fetch("/api/tables");
      const data = await res.json();
      setTables(data.tables || []);
    } finally {
      setTablesLoading(false);
    }
  }, []);

  const fetchReservations = useCallback(async () => {
    try {
      const res = await fetch(`/api/reservations?date=${resvDate}`);
      const data = await res.json();
      setReservations(data.reservations || []);
    } finally {
      setResvLoading(false);
    }
  }, [resvDate]);

  useEffect(() => {
    fetchTables();
    const t = setInterval(fetchTables, 15000);
    return () => clearInterval(t);
  }, [fetchTables]);

  useEffect(() => {
    fetchTableRequests();
    const t = setInterval(fetchTableRequests, 8000);
    return () => clearInterval(t);
  }, [fetchTableRequests]);

  useEffect(() => {
    setResvLoading(true);
    fetchReservations();
  }, [fetchReservations]);

  const handleTableStatus = async (id: number, status: string) => {
    await fetch("/api/tables", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    fetchTables();
  };

  const handleResvStatus = async (id: number, status: string) => {
    setUpdating(id);
    try {
      await fetch("/api/reservations", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
      await fetchReservations();
    } finally {
      setUpdating(null);
    }
  };

  const handleSeatWithTable = async (tableId: number) => {
    if (!seatResv) return;
    await fetch("/api/reservations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: seatResv.id, status: "seated", table_id: tableId }),
    });
    // Mark table occupied
    await fetch("/api/tables", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tableId, status: "occupied" }),
    });
    setSeatResv(null);
    await Promise.all([fetchReservations(), fetchTables()]);
  };

  const groups = {
    main:    tables.filter(t => t.location === "main"),
    outdoor: tables.filter(t => t.location === "outdoor"),
    private: tables.filter(t => t.location === "private"),
  };

  const summary = {
    available: tables.filter(t => t.status === "available").length,
    occupied:  tables.filter(t => t.status === "occupied").length,
    reserved:  tables.filter(t => t.status === "reserved").length,
    attention: tables.filter(t => t.status === "occupied" && t.occupied_since && minutesSince(t.occupied_since) >= TABLE_ATTENTION_MINUTES).length,
  };

  const resvBadge = reservations.filter(r => r.status === "pending").length;

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Header */}
      <div className="bg-surface border-b border-border px-4 py-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🍽️</span>
            <div>
              <h1 className="text-foreground font-bold text-lg">Table Management</h1>
              <p className="text-muted-foreground text-xs">The Royal Chilli · Hounslow</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /><span className="text-green-700 text-sm">{summary.available} Free</span></div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /><span className="text-red-700 text-sm">{summary.occupied} Occupied</span></div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /><span className="text-yellow-700 text-sm">{summary.reserved} Reserved</span></div>
            {summary.attention > 0 && (
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-600 animate-pulse" /><span className="text-orange-700 text-sm font-bold">{summary.attention} Needs Attention</span></div>
            )}
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 mt-3 bg-surface-hover p-1 rounded-xl w-fit">
          <button onClick={() => setTab("tables")}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab === "tables" ? "bg-red-500 text-white" : "text-muted-foreground hover:text-foreground"}`}>
            🪑 Tables
          </button>
          <button onClick={() => setTab("reservations")}
            className={`relative px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab === "reservations" ? "bg-red-500 text-white" : "text-muted-foreground hover:text-foreground"}`}>
            📅 Reservations
            {resvBadge > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                {resvBadge}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Table requests banner */}
      {tableRequests.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-300 px-4 py-2 space-y-1.5">
          {tableRequests.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 max-w-2xl mx-auto">
              <span className="text-amber-800 text-sm font-medium">
                {r.type === "waiter" ? "🙋" : "🧾"} Table {r.table_number} {r.type === "waiter" ? "wants a waiter" : "requested the bill"}
              </span>
              <button
                onClick={() => resolveTableRequest(r.id)}
                className="px-3 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 text-xs font-semibold rounded-lg transition-colors"
              >
                Resolve
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto">

        {/* ── TABLES TAB ── */}
        {tab === "tables" && (
          tablesLoading ? (
            <div className="text-muted-foreground text-center mt-20 animate-pulse">Loading tables…</div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groups).map(([loc, locTables]) => {
                if (locTables.length === 0) return null;
                return (
                  <div key={loc}>
                    <h2 className="text-muted-foreground text-xs font-bold uppercase tracking-widest mb-3">
                      {loc === "main" ? "Main Floor" : loc === "outdoor" ? "Outdoor" : "Private Room"}
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {locTables.map(table => {
                        const elapsedMins = table.occupied_since ? minutesSince(table.occupied_since) : null;
                        const needsAttention = table.status === "occupied" && elapsedMins !== null && elapsedMins >= TABLE_ATTENTION_MINUTES;
                        const cfg = tableStatusCfg[needsAttention ? "attention" : table.status];
                        return (
                          <div key={table.id} className={`rounded-2xl border-2 p-4 ${cfg.color} transition-all`}>
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-2xl font-black">{table.table_number}</span>
                              <span className={`w-3 h-3 rounded-full ${cfg.dot} ${needsAttention ? "animate-pulse" : ""}`} />
                            </div>
                            <div className="text-sm font-semibold mb-1">{needsAttention ? "⚠️ " : ""}{cfg.label}</div>
                            <div className="text-xs opacity-70 mb-3">
                              {table.capacity} seats{elapsedMins !== null ? ` · ${tableElapsedLabel(elapsedMins)}` : ""}
                            </div>
                            <div className="space-y-1.5">
                              {table.status !== "available" && (
                                <button onClick={() => handleTableStatus(table.id, "available")}
                                  className="w-full py-1.5 bg-green-100 hover:bg-green-200 text-green-800 text-xs font-semibold rounded-lg transition-colors no-select pos-btn">
                                  Set Free
                                </button>
                              )}
                              {table.status !== "occupied" && (
                                <button onClick={() => handleTableStatus(table.id, "occupied")}
                                  className="w-full py-1.5 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-semibold rounded-lg transition-colors no-select pos-btn">
                                  Set Occupied
                                </button>
                              )}
                              {table.status !== "reserved" && (
                                <button onClick={() => handleTableStatus(table.id, "reserved")}
                                  className="w-full py-1.5 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 text-xs font-semibold rounded-lg transition-colors no-select pos-btn">
                                  Reserve
                                </button>
                              )}
                              <button onClick={() => router.push("/pos")}
                                className="w-full py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-colors no-select pos-btn">
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
          )
        )}

        {/* ── RESERVATIONS TAB ── */}
        {tab === "reservations" && (
          <div className="max-w-2xl mx-auto space-y-4">

            <div className="flex items-center gap-3">
              <label className="text-muted-foreground text-sm font-semibold">Date</label>
              <input type="date" value={resvDate} onChange={e => setResvDate(e.target.value)}
                className="bg-surface-hover border border-elevated text-foreground text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-red-500" />
              <button onClick={() => setResvDate(todayStr())}
                className="px-3 py-1.5 bg-elevated hover:bg-elevated-hover text-foreground text-xs font-semibold rounded-lg border border-elevated">
                Today
              </button>
              <span className="text-muted-foreground text-xs">{reservations.length} booking{reservations.length !== 1 ? "s" : ""}</span>
            </div>

            {resvLoading ? (
              <div className="text-muted-foreground text-sm animate-pulse text-center py-10">Loading…</div>
            ) : reservations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                <span className="text-4xl">📅</span>
                <p className="text-sm">No bookings for this date</p>
              </div>
            ) : (
              <div className="space-y-2">
                {reservations.map(r => {
                  const cfg = resvStatusCfg[r.status] ?? resvStatusCfg.pending;
                  const busy = updating === r.id;
                  return (
                    <div key={r.id} className={`rounded-xl border p-4 ${cfg.bg}`}>
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-foreground font-bold">{r.customer_name}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
                              {cfg.label}
                            </span>
                            {r.source === "website" && (
                              <span className="text-[10px] text-blue-600 font-semibold">🌐 Website</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-red-600 font-bold text-sm">{fmtTime(r.reservation_time)}</span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground text-sm">👥 {r.party_size} guests</span>
                            {r.table_number && (
                              <>
                                <span className="text-muted-foreground">·</span>
                                <span className="text-emerald-600 text-sm font-semibold">🪑 Table {r.table_number}</span>
                              </>
                            )}
                            {r.customer_phone && (
                              <>
                                <span className="text-muted-foreground">·</span>
                                <a href={`tel:${r.customer_phone}`} className="text-blue-600 text-sm hover:underline">
                                  {r.customer_phone}
                                </a>
                              </>
                            )}
                          </div>
                          {r.notes && (
                            <div className="mt-2 text-xs text-amber-700 bg-amber-100 border border-amber-300 rounded-lg px-2.5 py-1.5">
                              📝 {r.notes}
                            </div>
                          )}
                        </div>
                      </div>

                      {r.status === "waitlisted" && (
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => handleResvStatus(r.id, "pending")} disabled={busy}
                            className="flex-1 h-9 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all no-select">
                            {busy ? "…" : "⬆ Promote to Reservation"}
                          </button>
                          <button onClick={() => handleResvStatus(r.id, "cancelled")} disabled={busy}
                            className="h-9 px-3 bg-surface-hover hover:bg-red-100 border border-border hover:border-red-300 text-muted-foreground hover:text-red-600 text-xs font-semibold rounded-lg transition-all disabled:opacity-50 no-select">
                            Remove
                          </button>
                        </div>
                      )}

                      {(r.status === "pending" || r.status === "confirmed") && (
                        <div className="flex gap-2 mt-3">
                          {r.status === "pending" && (
                            <button onClick={() => handleResvStatus(r.id, "confirmed")} disabled={busy}
                              className="flex-1 h-9 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all no-select">
                              {busy ? "…" : "✓ Confirm"}
                            </button>
                          )}
                          {r.status === "confirmed" && (
                            <button onClick={() => setSeatResv(r)} disabled={busy}
                              className="flex-1 h-9 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all no-select">
                              🪑 Seat Now — Pick Table
                            </button>
                          )}
                          <button onClick={() => handleResvStatus(r.id, "no_show")} disabled={busy}
                            className="h-9 px-3 bg-elevated hover:bg-elevated-hover border border-elevated text-muted-foreground text-xs font-semibold rounded-lg transition-all disabled:opacity-50 no-select">
                            No Show
                          </button>
                          <button onClick={() => handleResvStatus(r.id, "cancelled")} disabled={busy}
                            className="h-9 px-3 bg-surface-hover hover:bg-red-100 border border-border hover:border-red-300 text-muted-foreground hover:text-red-600 text-xs font-semibold rounded-lg transition-all disabled:opacity-50 no-select">
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="bg-surface border-t border-border px-4 py-3 flex gap-3">
        <Link href="/pos" className="px-4 py-2 bg-surface-hover hover:bg-elevated text-foreground text-sm font-semibold rounded-lg border border-border transition-colors">
          ← Back to POS
        </Link>
        <Link href="/pos/kitchen" className="px-4 py-2 bg-surface-hover hover:bg-elevated text-foreground text-sm font-semibold rounded-lg border border-border transition-colors">
          🍳 Kitchen Display
        </Link>
        <Link href="/staff" className="px-4 py-2 bg-surface-hover hover:bg-elevated text-foreground text-sm font-semibold rounded-lg border border-border transition-colors">
          👥 Staff Hub
        </Link>
      </div>

      {/* Table picker modal */}
      {seatResv && (
        <TablePickerModal
          reservation={seatResv}
          tables={tables}
          onConfirm={handleSeatWithTable}
          onClose={() => setSeatResv(null)}
        />
      )}
    </div>
  );
}
