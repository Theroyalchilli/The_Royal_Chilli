"use client";

import { useEffect, useState } from "react";

// Staff Hub → Customers & Loyalty → Club Report: are new members coming back?
// The number to watch is the 2nd-visit rate — of those who came once, how
// many came again.

type Row = { month: string; joined: number; visit1: number; visit2: number; visit3: number; revenue: number; rewardCost: number };

const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : "—");
const money = (n: number) => `£${n.toFixed(2)}`;
const monthLabel = (m: string) => new Date(`${m}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric" });

export default function ClubReport() {
  const [data, setData] = useState<{ months: Row[]; total: Omit<Row, "month"> } | null>(null);

  useEffect(() => {
    fetch("/api/loyalty/report?months=12")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const t = data.total;

  const Tile = ({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) => (
    <div className={`rounded-xl border p-3 ${highlight ? "border-red-400 bg-red-50" : "border-border bg-surface"}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${highlight ? "text-red-600" : "text-foreground"}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );

  return (
    <div>
      <p className="text-sm text-muted-foreground">
        Members by the month they joined, over the last 12 months. A visit is a day with a paid order.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="Joined" value={String(t.joined)} sub="new members" />
        <Tile label="Made a 1st visit" value={pct(t.visit1, t.joined)} sub={`${t.visit1} of ${t.joined}`} />
        <Tile label="Came back (2nd visit)" value={pct(t.visit2, t.visit1)} sub={`${t.visit2} of ${t.visit1} first-timers`} highlight />
        <Tile label="Reward cost" value={pct(t.rewardCost, t.revenue)} sub={`${money(t.rewardCost)} of ${money(t.revenue)} spent`} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Joined in</th>
              <th className="px-3 py-2 text-right">Joined</th>
              <th className="px-3 py-2 text-right">1st visit</th>
              <th className="px-3 py-2 text-right">2nd visit</th>
              <th className="px-3 py-2 text-right">3rd visit</th>
              <th className="px-3 py-2 text-right">Spent</th>
              <th className="px-3 py-2 text-right">Reward cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.months.map((r) => (
              <tr key={r.month} className={r.joined === 0 ? "text-muted-foreground/60" : "text-foreground"}>
                <td className="px-3 py-2 font-medium">{monthLabel(r.month)}</td>
                <td className="px-3 py-2 text-right">{r.joined}</td>
                <td className="px-3 py-2 text-right">{r.visit1} <span className="text-xs text-muted-foreground">{pct(r.visit1, r.joined)}</span></td>
                <td className="px-3 py-2 text-right font-semibold">{r.visit2} <span className="text-xs font-normal text-muted-foreground">{pct(r.visit2, r.visit1)}</span></td>
                <td className="px-3 py-2 text-right">{r.visit3} <span className="text-xs text-muted-foreground">{pct(r.visit3, r.visit2)}</span></td>
                <td className="px-3 py-2 text-right">{money(r.revenue)}</td>
                <td className="px-3 py-2 text-right">{money(r.rewardCost)} <span className="text-xs text-muted-foreground">{pct(r.rewardCost, r.revenue)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        % under each visit = of the step before (e.g. 2nd visit % = of those who made a 1st visit). Reward cost = discounts from
        loyalty vouchers and points on these members&apos; bills.
      </p>
    </div>
  );
}
