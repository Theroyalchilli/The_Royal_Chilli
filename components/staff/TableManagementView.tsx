"use client";

import { useCallback, useEffect, useState } from "react";

type Table = {
  id: number;
  table_number: string;
  capacity: number;
  status: "available" | "occupied" | "reserved";
};

const statusCfg: Record<Table["status"], { label: string; dot: string; text: string }> = {
  available: { label: "Free", dot: "bg-emerald-500", text: "text-muted-foreground" },
  occupied: { label: "Occupied", dot: "bg-red-500", text: "text-red-600" },
  reserved: { label: "Reserved", dot: "bg-amber-500", text: "text-amber-600" },
};

// "T2" before "T10" — plain string sort would flip them.
const naturalCompare = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

export default function TableManagementView() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [newNumber, setNewNumber] = useState("");
  const [newCapacity, setNewCapacity] = useState("4");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNumber, setEditNumber] = useState("");
  const [editCapacity, setEditCapacity] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/tables");
    const data = await res.json();
    setTables(data.tables || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Something went wrong"); return false; }
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function addTable() {
    const number = newNumber.trim();
    const capacity = Number(newCapacity);
    if (!number || !Number.isFinite(capacity) || capacity < 1) {
      setError("Enter a table number and a capacity of at least 1.");
      return;
    }
    if (await call("/api/tables", "POST", { table_number: number, capacity })) {
      setNewNumber("");
      setNewCapacity("4");
    }
  }

  function startEdit(t: Table) {
    setEditingId(t.id);
    setEditNumber(t.table_number);
    setEditCapacity(String(t.capacity));
    setError("");
  }

  async function saveEdit(id: number) {
    const number = editNumber.trim();
    const capacity = Number(editCapacity);
    if (!number || !Number.isFinite(capacity) || capacity < 1) {
      setError("Enter a table number and a capacity of at least 1.");
      return;
    }
    if (await call("/api/tables", "PUT", { id, table_number: number, capacity })) {
      setEditingId(null);
    }
  }

  const sorted = [...tables].sort((a, b) => naturalCompare(a.table_number, b.table_number));
  const totalSeats = tables.reduce((sum, t) => sum + t.capacity, 0);

  return (
    <>
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur px-4 py-4">
        <div className="mx-auto max-w-2xl flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-foreground font-semibold text-lg">Tables</h1>
            <p className="text-muted-foreground text-xs mt-0.5">
              {tables.length} table{tables.length === 1 ? "" : "s"} · {totalSeats} seats
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-6">
        <div className="mx-auto max-w-2xl">

          {/* Add */}
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="text-xs font-semibold text-foreground">Add a table</p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[120px]">
                <label className="block text-[11px] text-muted-foreground mb-1">Table number</label>
                <input
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTable()}
                  placeholder="e.g. T11"
                  className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                />
              </div>
              <div className="w-24">
                <label className="block text-[11px] text-muted-foreground mb-1">Seats</label>
                <input
                  type="number" min={1}
                  value={newCapacity}
                  onChange={(e) => setNewCapacity(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTable()}
                  className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                />
              </div>
              <button
                onClick={addTable}
                disabled={busy || !newNumber.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg"
              >
                + Add
              </button>
            </div>
          </div>

          {error && <p className="mt-3 text-red-600 text-sm">{error}</p>}

          {/* List */}
          <div className="mt-4 space-y-1.5">
            {loading ? (
              <p className="text-muted-foreground text-sm text-center py-10 animate-pulse">Loading…</p>
            ) : sorted.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-10">No tables yet — add one above.</p>
            ) : (
              sorted.map((t) => {
                const cfg = statusCfg[t.status];
                const isEditing = editingId === t.id;
                return (
                  <div key={t.id} className="rounded-lg border border-border bg-surface px-3 py-2.5 flex items-center gap-3">
                    {isEditing ? (
                      <>
                        <input
                          autoFocus
                          value={editNumber}
                          onChange={(e) => setEditNumber(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(t.id); if (e.key === "Escape") setEditingId(null); }}
                          className="w-28 bg-surface-hover border border-border rounded-lg px-2 py-1 text-foreground text-sm font-medium"
                        />
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number" min={1}
                            value={editCapacity}
                            onChange={(e) => setEditCapacity(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(t.id); if (e.key === "Escape") setEditingId(null); }}
                            className="w-16 bg-surface-hover border border-border rounded-lg px-2 py-1 text-foreground text-sm"
                          />
                          <span className="text-muted-foreground text-xs">seats</span>
                        </div>
                        <div className="flex-1" />
                        <button onClick={() => saveEdit(t.id)} disabled={busy} className="text-xs font-semibold text-red-600">Save</button>
                        <button onClick={() => setEditingId(null)} className="text-xs text-muted-foreground">Cancel</button>
                      </>
                    ) : (
                      <>
                        <span className="text-foreground font-semibold text-sm w-28">{t.table_number}</span>
                        <span className="text-muted-foreground text-sm">{t.capacity} seats</span>
                        <span className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                          <span className={`text-xs ${cfg.text}`}>{cfg.label}</span>
                        </span>
                        <div className="flex-1" />
                        <button onClick={() => startEdit(t)} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Edit</button>
                        <button
                          onClick={() => { if (confirm(`Delete table ${t.table_number}?`)) call(`/api/tables?id=${t.id}`, "DELETE"); }}
                          disabled={busy}
                          className="text-xs font-semibold text-red-600 hover:text-red-500"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <p className="mt-4 text-muted-foreground text-xs">
            A table that&apos;s already had orders or bookings can&apos;t be deleted — rename it instead if you&apos;re
            rearranging the floor.
          </p>
        </div>
      </div>
    </>
  );
}
