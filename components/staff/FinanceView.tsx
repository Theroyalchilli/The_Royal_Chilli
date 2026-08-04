"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

function fmtMoney(n: number) { return `£${Number(n).toFixed(2)}`; }
function firstOfMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }
function today() { return new Date().toISOString().slice(0, 10); }

function DateRangePicker({ from, to, setFrom, setTo }: { from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
      <span className="text-muted-foreground">to</span>
      <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
    </div>
  );
}

function PnlTab() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [data, setData] = useState<{ revenue: number; ingredient_purchases: number; labour_cost: number; other_expenses: number; net_profit: number } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/finance/pnl?from=${from}&to=${to}`);
    setData(await res.json());
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <DateRangePicker from={from} to={to} setFrom={setFrom} setTo={setTo} />
      {data && (
        <div className="mt-4 rounded-xl border border-border bg-surface divide-y divide-border">
          <Row label="Revenue" value={data.revenue} positive />
          <Row label="Ingredient Purchases" value={-data.ingredient_purchases} />
          <Row label="Labour Cost" value={-data.labour_cost} />
          <Row label="Other Expenses" value={-data.other_expenses} />
          <Row label="Net Profit" value={data.net_profit} bold />
        </div>
      )}
      <p className="mt-3 text-muted-foreground text-xs">Ingredient purchases are used as a cost-of-goods proxy (money spent on stock received in this period) rather than a full inventory-valuation COGS calculation.</p>
    </div>
  );
}

function Row({ label, value, positive, bold }: { label: string; value: number; positive?: boolean; bold?: boolean }) {
  const color = bold ? (value >= 0 ? "text-emerald-600" : "text-red-600") : positive ? "text-foreground" : "text-foreground";
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
  const [data, setData] = useState<{ revenue: number; output_vat: number; vat_applicable_expenses: number; input_vat: number; net_vat_due: number } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/finance/vat?from=${from}&to=${to}`);
    setData(await res.json());
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <DateRangePicker from={from} to={to} setFrom={setFrom} setTo={setTo} />
      {data && (
        <div className="mt-4 rounded-xl border border-border bg-surface divide-y divide-border">
          <Row label="Sales (VAT-inclusive)" value={data.revenue} />
          <Row label="Output VAT (on sales)" value={data.output_vat} />
          <Row label="Expenses with VAT" value={data.vat_applicable_expenses} />
          <Row label="Input VAT (reclaimable)" value={-data.input_vat} />
          <Row label="Net VAT Due" value={data.net_vat_due} bold />
        </div>
      )}
      <p className="mt-3 text-amber-600 text-xs">⚠ Estimate only — assumes standard-rated sales and that raw ingredient purchases are zero-rated (typical for UK food wholesale). Verify with your accountant before filing.</p>
    </div>
  );
}

function CashReconTab() {
  const [periods, setPeriods] = useState<{ id: number; opened_at: string; opening_cash: number; cash_sales: number; expected_cash: number; actual_cash: number | null; variance: number | null }[]>([]);
  useEffect(() => { fetch("/api/finance/cash-reconciliation").then((r) => r.json()).then((d) => setPeriods(d.periods || [])); }, []);

  return (
    <div className="space-y-2">
      {periods.map((p) => (
        <div key={p.id} className="rounded-lg border border-border bg-surface px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-foreground font-semibold">{new Date(p.opened_at).toLocaleDateString("en-GB")}</p>
            <p className="text-muted-foreground text-sm">Opening {fmtMoney(p.opening_cash)} + Cash sales {fmtMoney(p.cash_sales)} = Expected {fmtMoney(p.expected_cash)}</p>
          </div>
          <div className="text-right">
            <p className="text-foreground">Actual: {p.actual_cash !== null ? fmtMoney(p.actual_cash) : "—"}</p>
            {p.variance !== null && (
              <p className={`text-sm font-bold ${p.variance === 0 ? "text-emerald-600" : Math.abs(p.variance) < 1 ? "text-amber-600" : "text-red-600"}`}>
                {p.variance === 0 ? "Balanced" : `${p.variance > 0 ? "+" : ""}${fmtMoney(p.variance)}`}
              </p>
            )}
          </div>
        </div>
      ))}
      {periods.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">No closed till sessions yet.</p>}
    </div>
  );
}

function ExpensesTab() {
  const [expenses, setExpenses] = useState<{ id: number; category: string; description: string; amount: number; expense_date: string; vat_applicable: number }[]>([]);
  const [form, setForm] = useState({ category: "other", description: "", amount: "", vat_applicable: true, expense_date: today() });

  const load = useCallback(async () => {
    const res = await fetch("/api/expenses");
    setExpenses((await res.json()).expenses || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!form.description || !form.amount) return;
    await fetch("/api/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, amount: Number(form.amount), vat_applicable: form.vat_applicable ? 1 : 0 }) });
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
        <button onClick={save} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg">+ Add</button>
      </div>
      <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={form.vat_applicable} onChange={(e) => setForm({ ...form, vat_applicable: e.target.checked })} /> VAT applicable
      </label>
      <div className="mt-4 space-y-1.5">
        {expenses.map((e) => (
          <div key={e.id} className="flex justify-between text-sm rounded-lg border border-border bg-surface px-4 py-2">
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

  const load = useCallback(async () => {
    const res = await fetch("/api/supplier-payments");
    setPayments((await res.json()).payments || []);
  }, []);
  useEffect(() => { load(); fetch("/api/suppliers").then((r) => r.json()).then((d) => setSuppliers(d.suppliers || [])); }, [load]);

  async function save() {
    if (!form.supplier_id || !form.amount) return;
    await fetch("/api/supplier-payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ supplier_id: Number(form.supplier_id), amount: Number(form.amount), method: form.method }) });
    setForm({ supplier_id: "", amount: "", method: "bank_transfer" });
    load();
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm col-span-2">
          <option value="">Select supplier…</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="number" step="0.01" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
        <button onClick={save} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg">+ Record</button>
      </div>
      <div className="mt-4 space-y-1.5">
        {payments.map((p) => (
          <div key={p.id} className="flex justify-between text-sm rounded-lg border border-border bg-surface px-4 py-2">
            <span className="text-foreground">{p.supplier_name} {p.method && `· ${p.method}`} <span className="text-muted-foreground">({new Date(p.paid_at).toLocaleDateString("en-GB")})</span></span>
            <span className="text-foreground">{fmtMoney(p.amount)}</span>
          </div>
        ))}
        {payments.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">No supplier payments recorded yet.</p>}
      </div>
    </div>
  );
}

export default function FinanceView() {
  const [tab, setTab] = useState<"pnl" | "vat" | "cash" | "expenses" | "supplier_payments">("pnl");
  const tabs = [
    { id: "pnl", label: "Profit & Loss" },
    { id: "vat", label: "VAT" },
    { id: "cash", label: "Cash Reconciliation" },
    { id: "expenses", label: "Expenses" },
    { id: "supplier_payments", label: "Supplier Payments" },
  ] as const;

  return (
    <>
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur px-4 py-4">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h1 className="text-foreground font-bold text-2xl">Finance</h1>
            <div className="flex items-center gap-2">
              <Link href="/staff" className="px-4 py-2 bg-surface-hover hover:bg-elevated text-foreground text-sm font-semibold rounded-lg border border-border">← Staff Hub</Link>
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
          {tab === "cash" && <CashReconTab />}
          {tab === "expenses" && <ExpensesTab />}
          {tab === "supplier_payments" && <SupplierPaymentsTab />}
        </div>
      </div>
      </div>
    </>
  );
}
