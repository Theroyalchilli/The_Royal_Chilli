"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Row = { staff_id: number; name: string; role: string; hours_worked: number; late_count: number; labour_cost: number };

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function StaffReportsView() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState({ hours: 0, cost: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/staff-reports?from=${from}&to=${to}`);
    const data = await res.json();
    setRows(data.rows || []);
    setTotals(data.totals || { hours: 0, cost: 0 });
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  function exportCsv() {
    const header = "Name,Role,Hours Worked,Late Count,Labour Cost (GBP)\n";
    const body = rows.map((r) => `"${r.name}","${r.role}",${r.hours_worked},${r.late_count},${r.labour_cost}`).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `staff-report-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur px-4 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-foreground font-semibold text-lg">Staff Reports</h1>
            <p className="text-muted-foreground text-sm">Hours worked and labour cost by employee, for any date range.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/staff" className="px-4 py-2 bg-surface-hover hover:bg-elevated text-foreground text-sm font-semibold rounded-lg border border-border">← Staff Hub</Link>
          </div>
        </div>
      </div>

      <div className="px-4 py-6">
      <div className="mx-auto max-w-4xl">
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
          <span className="text-muted-foreground">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
          <button onClick={exportCsv} className="px-4 py-2 bg-surface-hover hover:bg-elevated text-foreground text-sm font-semibold rounded-lg border border-border">⬇ Export CSV</button>
        </div>

        <p className="mt-3 text-muted-foreground text-sm">Total hours: <span className="text-foreground font-semibold">{totals.hours.toFixed(2)}</span> · Total labour cost: <span className="text-foreground font-semibold">£{totals.cost.toFixed(2)}</span></p>

        <div className="mt-4 rounded-xl border border-border overflow-x-auto">
          {loading ? (
            <div className="text-muted-foreground text-center py-16">Loading…</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Role</th>
                  <th className="text-right px-4 py-3">Hours</th>
                  <th className="text-right px-4 py-3">Late</th>
                  <th className="text-right px-4 py-3">Labour Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.staff_id} className="bg-background">
                    <td className="px-4 py-3 text-foreground font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-foreground capitalize">{r.role.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-right text-foreground">{r.hours_worked.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-foreground">{r.late_count}</td>
                    <td className="px-4 py-3 text-right text-foreground">£{r.labour_cost.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      </div>
    </>
  );
}
