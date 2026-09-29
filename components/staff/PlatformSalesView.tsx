"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { PLATFORMS, type PlatformKey } from "@/lib/platforms";

type Row = { sales_date: string; platform: PlatformKey; orders: number; sales: number; commission: number };
type Entry = { orders: string; sales: string; commission: string };

const heading = { fontFamily: "var(--font-space-grotesk)" };
const gbp = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const LABEL = Object.fromEntries(PLATFORMS.map((p) => [p.key, p.label])) as Record<PlatformKey, string>;
const blank = (): Record<PlatformKey, Entry> =>
  Object.fromEntries(PLATFORMS.map((p) => [p.key, { orders: "", sales: "", commission: "" }])) as Record<PlatformKey, Entry>;

function addDays(d: string, n: number) {
  const x = new Date(d + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
const niceDate = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

export default function PlatformSalesView({ today }: { today: string }) {
  const { toast } = useToast();
  const [date, setDate] = useState(addDays(today, -1));
  const [entry, setEntry] = useState<Record<PlatformKey, Entry>>(blank);
  const [recent, setRecent] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/staff/platform-sales?from=${addDays(today, -27)}&to=${today}`);
    if (res.ok) setRecent((await res.json()).rows);
  }, [today]);
  useEffect(() => { load(); }, [load]);

  // Fill the form with whatever is already saved for the chosen day.
  useEffect(() => {
    const next = blank();
    for (const r of recent.filter((r) => r.sales_date === date)) {
      next[r.platform] = { orders: String(r.orders), sales: String(Number(r.sales)), commission: String(Number(r.commission)) };
    }
    setEntry(next);
  }, [date, recent]);

  const set = (p: PlatformKey, field: keyof Entry, v: string) => setEntry((e) => ({ ...e, [p]: { ...e[p], [field]: v } }));

  async function save() {
    setSaving(true);
    const rows = PLATFORMS.map((p) => ({ platform: p.key, orders: entry[p.key].orders, sales: entry[p.key].sales, commission: entry[p.key].commission }));
    const res = await fetch("/api/staff/platform-sales", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, rows }) });
    setSaving(false);
    if (!res.ok) {
      toast({ title: "Not saved", description: (await res.json().catch(() => ({}))).error ?? "Please try again", variant: "destructive" });
      return;
    }
    toast({ title: `Saved ${niceDate(date)}` });
    load();
  }

  const days = [...new Set(recent.map((r) => r.sales_date))].sort().reverse();
  const input = "w-full rounded-lg border border-border bg-background px-2.5 py-2 text-right text-[14px] tabular-nums focus:outline-none focus:ring-2 focus:ring-red-600/30";

  return (
    <div className="px-4 py-6 md:px-6 md:py-7">
      <div className="mx-auto max-w-[900px]">
        <h1 style={heading} className="text-[26px] font-semibold tracking-[-0.02em] text-foreground">Delivery platforms</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Each tablet prints its own orders — just type in the day&apos;s totals from its summary. Sales = the total customers paid, before commission.
        </p>

        <div className="mt-5 rounded-[14px] border border-border bg-surface p-4 md:p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="text-[13px] font-medium text-muted-foreground" htmlFor="ps-date">Day</label>
            <input id="ps-date" type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)}
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-[14px]" />
            <span className="text-[13px] text-muted-foreground">{niceDate(date)}</span>
          </div>

          <div className="grid grid-cols-[1fr_repeat(3,minmax(0,1fr))] gap-2 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground max-sm:hidden">
            <span>Platform</span><span className="text-right">Orders</span><span className="text-right">Sales £</span><span className="text-right">Commission £</span>
          </div>
          {PLATFORMS.map((p) => {
            const e = entry[p.key];
            const keep = (Number(e.sales) || 0) - (Number(e.commission) || 0);
            return (
              <div key={p.key} className="grid grid-cols-3 items-center gap-2 border-t border-border py-3 sm:grid-cols-[1fr_repeat(3,minmax(0,1fr))] sm:border-t-0 sm:py-1.5">
                <div className="col-span-3 sm:col-span-1">
                  <span className="text-[14.5px] font-semibold">{p.label}</span>
                  {(Number(e.sales) || 0) > 0 && <span className="ml-2 text-[12px] text-emerald-700">you keep {gbp(keep)}</span>}
                </div>
                <label className="text-[11px] text-muted-foreground sm:contents">
                  <span className="sm:hidden">Orders</span>
                  <input className={input} inputMode="numeric" value={e.orders} onChange={(ev) => set(p.key, "orders", ev.target.value.replace(/[^0-9]/g, ""))} placeholder="0" />
                </label>
                <label className="text-[11px] text-muted-foreground sm:contents">
                  <span className="sm:hidden">Sales £</span>
                  <input className={input} inputMode="decimal" value={e.sales} onChange={(ev) => set(p.key, "sales", ev.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" />
                </label>
                <label className="text-[11px] text-muted-foreground sm:contents">
                  <span className="sm:hidden">Commission £</span>
                  <input className={input} inputMode="decimal" value={e.commission} onChange={(ev) => set(p.key, "commission", ev.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" />
                </label>
              </div>
            );
          })}
          <div className="mt-4 flex justify-end">
            <button onClick={save} disabled={saving} className="rounded-lg bg-red-600 px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-red-700 disabled:opacity-60">
              {saving ? "Saving…" : "Save day"}
            </button>
          </div>
        </div>

        <h2 style={heading} className="mb-2 mt-7 text-[16px] font-semibold">Last 4 weeks</h2>
        {days.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing entered yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-[14px] border border-border bg-surface">
            <table className="w-full min-w-[520px] text-[13.5px]">
              <thead>
                <tr className="text-[11.5px] uppercase tracking-[0.04em] text-muted-foreground">
                  <th className="px-4 py-2 text-left font-semibold">Day</th>
                  <th className="px-2 py-2 text-left font-semibold">Platform</th>
                  <th className="px-2 py-2 text-right font-semibold">Orders</th>
                  <th className="px-2 py-2 text-right font-semibold">Sales</th>
                  <th className="px-2 py-2 text-right font-semibold">Commission</th>
                  <th className="px-4 py-2 text-right font-semibold">You keep</th>
                </tr>
              </thead>
              <tbody>
                {days.flatMap((d) =>
                  recent.filter((r) => r.sales_date === d).map((r, i) => (
                    <tr key={d + r.platform} className={`cursor-pointer hover:bg-surface-hover ${i === 0 ? "border-t border-border" : ""}`} onClick={() => setDate(d)}>
                      <td className="px-4 py-1.5">{i === 0 ? niceDate(d) : ""}</td>
                      <td className="px-2 py-1.5">{LABEL[r.platform]}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.orders}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{gbp(Number(r.sales))}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{gbp(Number(r.commission))}</td>
                      <td className="px-4 py-1.5 text-right font-semibold tabular-nums text-emerald-700">{gbp(Number(r.sales) - Number(r.commission))}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
