"use client";

import { useCallback, useEffect, useState } from "react";
import ZReportView from "@/components/pos/ZReportView";
import { zDateTime, type ZReport } from "@/lib/z-report";
import { firstOfMonthStr, tradingDayStr } from "@/lib/london-date";

function fmtMoney(n: number) { return `£${Number(n).toFixed(2)}`; }
function firstOfMonth() { return firstOfMonthStr(tradingDayStr()); }
function today() { return tradingDayStr(); }

function DateRangePicker({ from, to, setFrom, setTo }: { from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void }) {
  const isToday = from === today() && to === today();
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
      <span className="text-muted-foreground">to</span>
      <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
      <button
        onClick={() => { setFrom(today()); setTo(today()); }}
        className={`px-3 py-2 text-sm font-semibold rounded-lg border transition-colors ${isToday ? "bg-red-600 border-red-500 text-white" : "bg-surface-hover border-border text-foreground hover:bg-elevated"}`}
      >
        Today
      </button>
    </div>
  );
}

// Same shape as lib/finance.ts Pnl — the admin dashboard summary reads the same numbers.
type Pnl = {
  vat_rate: number;
  sales: { own_gross: number; refunds: number; own: number; platforms: number; total: number; vat_own: number; vat_platforms: number; vat: number; ex_vat: number };
  costs: { ingredients: number; staff: number; expenses: number; commission: number; card_fees: number; total: number };
  profit: number;
  vat: { output: number; vat_applicable_expenses: number; input: number; net_due: number };
  recipe: { cogs: number; coverage_pct: number; profit: number };
};

function usePnl(from: string, to: string, path: "pnl" | "vat") {
  const [data, setData] = useState<Pnl | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setError("");
    fetch(`/api/finance/${path}?from=${from}&to=${to}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "Failed to load"); return d; })
      .then((d) => { if (live) setData(d); })
      .catch((e) => { if (live) { setData(null); setError(e.message); } });
    return () => { live = false; };
  }, [from, to, path]);
  return { data, error };
}

const cardClass = "mt-4 rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgba(32,27,24,0.04),0_8px_24px_rgba(32,27,24,0.05)] divide-y divide-border";

function PnlTab() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const { data, error } = usePnl(from, to, "pnl");

  return (
    <div>
      <DateRangePicker from={from} to={to} setFrom={setFrom} setTo={setTo} />
      {error && <p className="mt-4 text-red-600 text-sm">{error}</p>}
      {data && (
        <>
          <div className={cardClass}>
            <Row label="Own sales (till, QR, website)" value={data.sales.own_gross} />
            {data.sales.refunds > 0 && <Row label="Less refunds" value={-data.sales.refunds} />}
            <Row label="Delivery platforms" value={data.sales.platforms} />
            <Row label="Total sales (incl. VAT)" value={data.sales.total} bold />
            <Row label="Less VAT on sales" value={-data.sales.vat} />
            <Row label="Sales ex-VAT" value={data.sales.ex_vat} bold />
          </div>
          <div className={cardClass}>
            <Row label="Ingredients (purchase orders received)" value={-data.costs.ingredients} />
            <Row label="Staff (hours worked × pay rate)" value={-data.costs.staff} />
            <Row label="Other expenses (ex reclaimable VAT)" value={-data.costs.expenses} />
            <Row label="Delivery platform commission" value={-data.costs.commission} />
            <Row label="Card fees (estimate)" value={-data.costs.card_fees} />
            <Row label="Total costs" value={-data.costs.total} />
            <Row label="Net Profit" value={data.profit} bold />
          </div>
          <p className="mt-3 text-muted-foreground text-xs">
            Same figures as the admin dashboard. Own sales are paid orders on the day ordered (after discounts, tips excluded); refunds count on the day given.
            Ingredient cost is what was received on purchase orders in the period, not a stock valuation. Card fees are estimated at 1.75% of card and online takings.
          </p>

          <div className="mt-6 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 p-4">
            <p className="text-foreground font-bold text-sm">Recipe-Based COGS (accrual)</p>
            <p className="text-muted-foreground text-xs mt-1">
              Same bottom line, but with the recipe cost of what was actually sold in place of what was bought.
            </p>
            <div className="mt-3 rounded-lg border border-border bg-surface divide-y divide-border">
              <Row label="Recipe-based COGS" value={-data.recipe.cogs} />
              <Row label="Net Profit (recipe basis)" value={data.recipe.profit} bold />
            </div>
            <p className="mt-2 text-xs font-semibold" style={{ color: data.recipe.coverage_pct >= 80 ? "#16a34a" : data.recipe.coverage_pct >= 30 ? "#d97706" : "#dc2626" }}>
              Recipes cover {data.recipe.coverage_pct}% of own-order item sales.
              {data.recipe.coverage_pct < 80 && " Add recipes in Inventory → Recipes & Food Cost for a fuller picture."}
              {data.sales.platforms > 0 && " Delivery-platform orders aren't itemised, so their food cost isn't included here."}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  const color = bold ? (value >= 0 ? "text-emerald-600" : "text-red-600") : "text-foreground";
  return (
    <div className="flex justify-between px-4 py-3">
      <span className={bold ? "text-foreground font-bold" : "text-muted-foreground"}>{label}</span>
      <span className={`${color} ${bold ? "font-bold" : ""}`}>{value < 0 ? "-" : ""}{fmtMoney(Math.abs(value))}</span>
    </div>
  );
}

function VatTab() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const { data, error } = usePnl(from, to, "vat");

  return (
    <div>
      <DateRangePicker from={from} to={to} setFrom={setFrom} setTo={setTo} />
      {error && <p className="mt-4 text-red-600 text-sm">{error}</p>}
      {data && (
        <div className={cardClass}>
          <Row label="Own sales after refunds (incl. VAT)" value={data.sales.own} />
          <Row label="VAT on own sales" value={data.sales.vat_own} />
          <Row label="Delivery platform sales (incl. VAT)" value={data.sales.platforms} />
          <Row label="VAT on platform sales" value={data.sales.vat_platforms} />
          <Row label="Output VAT (on sales)" value={data.vat.output} bold />
          <Row label="Expenses with VAT" value={data.vat.vat_applicable_expenses} />
          <Row label="Input VAT (reclaimable)" value={-data.vat.input} />
          <Row label="Net VAT Due" value={data.vat.net_due} bold />
        </div>
      )}
      <p className="mt-3 text-amber-600 text-xs">⚠ Estimate only — assumes standard-rated sales (own VAT is what each bill actually charged; platform VAT is worked out from their gross sales), raw ingredient purchases zero-rated, and no VAT reclaimed on platform commission. Verify with your accountant before filing.</p>
    </div>
  );
}

function ZReportsTab() {
  const [reports, setReports] = useState<{ id: number; opened_at: string; closed_at: string | null; close_note: string | null; net_sales: number | null; difference: number | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<ZReport | null>(null);
  const [status, setStatus] = useState<Record<number, string>>({});

  useEffect(() => {
    fetch("/api/work-periods/z-reports").then((r) => r.json()).then((d) => { setReports(d.reports || []); setLoading(false); });
  }, []);

  async function view(id: number) {
    const res = await fetch(`/api/work-periods/${id}/z-report`);
    if (res.ok) setViewing((await res.json()).report);
  }

  async function print(id: number) {
    setStatus((s) => ({ ...s, [id]: "Sending…" }));
    const res = await fetch(`/api/work-periods/${id}/z-report`, { method: "POST" }).catch(() => null);
    setStatus((s) => ({ ...s, [id]: res?.ok ? "Sent to printer ✓" : "Couldn't send" }));
  }

  return (
    <div className="space-y-2">
      {reports.map((p) => (
        <div key={p.id} className="rounded-lg border border-border bg-surface shadow-[0_1px_2px_rgba(32,27,24,0.04),0_8px_24px_rgba(32,27,24,0.05)] px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-foreground font-semibold">Z Report {p.id}<span className="ml-2 text-muted-foreground font-normal text-sm">{p.closed_at ? zDateTime(p.closed_at) : ""}</span></p>
            <p className="text-muted-foreground text-sm">
              Opened {zDateTime(p.opened_at)}
              {p.net_sales !== null && ` · Net sales ${fmtMoney(p.net_sales)}`}
              {p.difference !== null && p.difference !== 0 && ` · Cash ${p.difference > 0 ? "+" : ""}${fmtMoney(p.difference)}`}
              {p.close_note && ` · ${p.close_note}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {status[p.id] && <span className="text-xs text-muted-foreground">{status[p.id]}</span>}
            <button onClick={() => view(p.id)} className="px-3 py-1.5 rounded-lg border border-border text-sm font-semibold text-foreground hover:bg-surface-hover">View</button>
            <button onClick={() => print(p.id)} className="px-3 py-1.5 rounded-lg bg-red-500 text-sm font-semibold text-white hover:bg-red-600">Print</button>
          </div>
        </div>
      ))}
      {!loading && reports.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">No closed till sessions yet.</p>}

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setViewing(null)}>
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-surface p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <ZReportView report={viewing} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => setViewing(null)} className="py-2.5 rounded-xl bg-surface-hover text-sm font-semibold text-foreground">Close</button>
              <button onClick={() => print(viewing.period_id)} className="py-2.5 rounded-xl bg-red-500 text-sm font-semibold text-white">{status[viewing.period_id] || "🖨️ Print"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// One Excel file per month for the accountant (app/api/finance/export):
// daily trading-day summary, payments, refunds and Z reports.
function AccountantExportTab() {
  const [month, setMonth] = useState(() => tradingDayStr().slice(0, 7));
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-4 space-y-3">
      <p className="text-foreground font-semibold">Monthly accounts export (Excel)</p>
      <p className="text-muted-foreground text-sm">
        Sheets: Daily summary (trading days, 5am–5am: sales taken, card/cash/online, tips, refunds, VAT, discounts), Payments, Refunds and Z reports.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
        <a
          href={`/api/finance/export?month=${month}`}
          className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold"
        >
          ⬇ Download {month}
        </a>
      </div>
    </div>
  );
}

function ExpensesTab() {
  const [expenses, setExpenses] = useState<{ id: number; category: string; description: string; amount: number; expense_date: string; vat_applicable: number }[]>([]);
  const [form, setForm] = useState({ category: "other", description: "", amount: "", vat_applicable: true, expense_date: today() });
  const [error, setError] = useState("");
  const [dupe, setDupe] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/expenses");
    setExpenses((await res.json()).expenses || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save() {
    setError("");
    if (!form.description.trim()) return setError("Add a description.");
    if (!(Number(form.amount) > 0)) return setError("Amount must be more than £0.");
    const res = await fetch("/api/expenses", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: Number(form.amount), vat_applicable: form.vat_applicable ? 1 : 0, allow_duplicate: dupe }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Couldn't save"); setDupe(!!data.duplicate); return; }
    setDupe(false);
    setForm({ category: "other", description: "", amount: "", vat_applicable: true, expense_date: today() });
    load();
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm">
          {["rent", "utilities", "marketing", "equipment", "professional_fees", "other"].map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
        </select>
        <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm col-span-2" />
        <input type="number" step="0.01" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
        <button onClick={save} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg">{dupe ? "Add anyway" : "+ Add"}</button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <label className="flex items-center gap-2">
          Date <input type="date" value={form.expense_date} onChange={(e) => { setForm({ ...form, expense_date: e.target.value }); setDupe(false); }} className="bg-surface-hover border border-border rounded-lg px-2 py-1 text-foreground text-sm" />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.vat_applicable} onChange={(e) => setForm({ ...form, vat_applicable: e.target.checked })} /> VAT applicable (amount includes VAT)
        </label>
      </div>
      {error && <p className="mt-2 text-red-600 text-xs">{error}{dupe && " — press Add anyway if it really is a second one."}</p>}
      <p className="mt-2 text-muted-foreground text-xs">
        Not for food/stock invoices — those are counted from Inventory → Purchase Orders when received. Not for staff pay (from attendance), card fees or delivery-platform commission (all worked out automatically).
      </p>
      <div className="mt-4 space-y-1.5">
        {expenses.map((e) => (
          <div key={e.id} className="flex justify-between text-sm rounded-lg border border-border bg-surface shadow-[0_1px_2px_rgba(32,27,24,0.04),0_8px_24px_rgba(32,27,24,0.05)] px-4 py-2">
            <span className="text-foreground capitalize">{e.category.replace("_", " ")} · {e.description} <span className="text-muted-foreground">({e.expense_date})</span></span>
            <span className="text-foreground">{fmtMoney(e.amount)}</span>
          </div>
        ))}
        {expenses.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">No expenses recorded yet.</p>}
      </div>
    </div>
  );
}

function SupplierPaymentsTab() {
  const [payments, setPayments] = useState<{ id: number; supplier_name: string; amount: number; method: string | null; paid_at: string }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([]);
  const [form, setForm] = useState({ supplier_id: "", amount: "", method: "bank_transfer" });
  const [error, setError] = useState("");
  const [dupe, setDupe] = useState(false);

  const loadSuppliers = useCallback(async () => {
    const res = await fetch("/api/suppliers");
    setSuppliers((await res.json()).suppliers || []);
  }, []);
  const load = useCallback(async () => {
    const res = await fetch("/api/supplier-payments");
    setPayments((await res.json()).payments || []);
  }, []);
  useEffect(() => { load(); loadSuppliers(); }, [load, loadSuppliers]);

  async function save() {
    setError("");
    if (!form.supplier_id) return setError("Pick a supplier.");
    if (!(Number(form.amount) > 0)) return setError("Amount must be more than £0.");
    const res = await fetch("/api/supplier-payments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplier_id: Number(form.supplier_id), amount: Number(form.amount), method: form.method, allow_duplicate: dupe }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Couldn't record payment"); setDupe(!!data.duplicate); return; }
    setDupe(false);
    setForm({ supplier_id: "", amount: "", method: "bank_transfer" });
    load();
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select value={form.supplier_id} onChange={(e) => { setForm({ ...form, supplier_id: e.target.value }); setDupe(false); }} className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm col-span-2">
          <option value="">Select supplier…</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="number" step="0.01" placeholder="Amount" value={form.amount} onChange={(e) => { setForm({ ...form, amount: e.target.value }); setDupe(false); }} className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
        <button onClick={save} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg">{dupe ? "Record anyway" : "+ Record"}</button>
      </div>
      {error && <p className="mt-2 text-red-600 text-xs">{error}{dupe && " — press Record anyway if it really is a second payment."}</p>}
      <p className="mt-2 text-muted-foreground text-xs">
        A record of money paid to suppliers — it isn&apos;t a cost in Profit &amp; Loss (the cost is counted once, when the purchase order is received). Suppliers are added in Inventory → Suppliers.
      </p>
      <div className="mt-4 space-y-1.5">
        {payments.map((p) => (
          <div key={p.id} className="flex justify-between text-sm rounded-lg border border-border bg-surface shadow-[0_1px_2px_rgba(32,27,24,0.04),0_8px_24px_rgba(32,27,24,0.05)] px-4 py-2">
            <span className="text-foreground">{p.supplier_name} {p.method && `· ${p.method.replace("_", " ")}`} <span className="text-muted-foreground">({new Date(p.paid_at).toLocaleDateString("en-GB")})</span></span>
            <span className="text-foreground">{fmtMoney(p.amount)}</span>
          </div>
        ))}
        {payments.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">No supplier payments recorded yet.</p>}
      </div>
    </div>
  );
}

export default function FinanceView() {
  const [tab, setTab] = useState<"pnl" | "vat" | "zreports" | "export" | "expenses" | "supplier_payments">("pnl");
  const tabs = [
    { id: "pnl", label: "Profit & Loss" },
    { id: "vat", label: "VAT" },
    { id: "zreports", label: "Z Reports" },
    { id: "export", label: "Accountant export" },
    { id: "expenses", label: "Expenses" },
    { id: "supplier_payments", label: "Supplier Payments" },
  ] as const;

  return (
    <>
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur px-4 py-4">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 style={{ fontFamily: "var(--font-space-grotesk)" }} className="text-foreground text-[22px] font-semibold tracking-[-0.02em]">Finance</h1>
              <p className="text-muted-foreground text-sm">Revenue, costs, profit and VAT — the numbers behind the till.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1 mt-4 bg-surface-hover p-1 rounded-xl">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap ${tab === t.id ? "bg-red-500 text-white" : "text-muted-foreground"}`}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-6">
      <div className="mx-auto max-w-4xl">
        <div className="mt-5">
          {tab === "pnl" && <PnlTab />}
          {tab === "vat" && <VatTab />}
          {tab === "zreports" && <ZReportsTab />}
          {tab === "export" && <AccountantExportTab />}
          {tab === "expenses" && <ExpensesTab />}
          {tab === "supplier_payments" && <SupplierPaymentsTab />}
        </div>
      </div>
      </div>
    </>
  );
}
