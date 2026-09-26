"use client";

import { useCallback, useEffect, useState } from "react";
import ZReportView from "@/components/pos/ZReportView";
import BrowserPrintButton from "@/components/pos/BrowserPrintButton";
import { zDateTime, type ZReport } from "@/lib/z-report";

function fmtMoney(n: number) { return `£${Number(n).toFixed(2)}`; }
function firstOfMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }
function today() { return new Date().toISOString().slice(0, 10); }

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

function PnlTab() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [data, setData] = useState<{
    revenue: number; ingredient_purchases: number; labour_cost: number; other_expenses: number; net_profit: number;
    recipe_cogs: number; recipe_cogs_coverage_pct: number; net_profit_recipe_basis: number;
  } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/finance/pnl?from=${from}&to=${to}`);
    setData(await res.json());
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <DateRangePicker from={from} to={to} setFrom={setFrom} setTo={setTo} />
      {data && (
        <div className="mt-4 rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgba(32,27,24,0.04),0_8px_24px_rgba(32,27,24,0.05)] divide-y divide-border">
          <Row label="Revenue" value={data.revenue} positive />
          <Row label="Ingredient Purchases" value={-data.ingredient_purchases} />
          <Row label="Labour Cost" value={-data.labour_cost} />
          <Row label="Other Expenses" value={-data.other_expenses} />
          <Row label="Net Profit" value={data.net_profit} bold />
        </div>
      )}
      <p className="mt-3 text-muted-foreground text-xs">Ingredient purchases are used as a cost-of-goods proxy (money spent on stock received in this period) rather than a full inventory-valuation COGS calculation.</p>

      {data && (
        <div className="mt-6 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 p-4">
          <p className="text-foreground font-bold text-sm">Recipe-Based COGS (accrual)</p>
          <p className="text-muted-foreground text-xs mt-1">
            Cost of what was actually sold, from recipe ingredient costs — not just what was bought.
          </p>
          <div className="mt-3 rounded-lg border border-border bg-surface shadow-[0_1px_2px_rgba(32,27,24,0.04),0_8px_24px_rgba(32,27,24,0.05)] divide-y divide-border">
            <Row label="Recipe-based COGS" value={-data.recipe_cogs} />
            <Row label="Net Profit (recipe basis)" value={data.net_profit_recipe_basis} bold />
          </div>
          <p className="mt-2 text-xs font-semibold" style={{ color: data.recipe_cogs_coverage_pct >= 80 ? "#16a34a" : data.recipe_cogs_coverage_pct >= 30 ? "#d97706" : "#dc2626" }}>
            Based on recipes covering {data.recipe_cogs_coverage_pct}% of this period&apos;s revenue.
            {data.recipe_cogs_coverage_pct < 80 && " Add recipes in Inventory → Recipes & Food Cost for a fuller picture."}
          </p>
        </div>
      )}
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
        <div className="mt-4 rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgba(32,27,24,0.04),0_8px_24px_rgba(32,27,24,0.05)] divide-y divide-border">
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
  const [periods, setPeriods] = useState<{ id: number; opened_at: string; opening_cash: number; cash_sales: number; cash_tips: number; expected_cash: number; actual_cash: number | null; variance: number | null }[]>([]);
  useEffect(() => { fetch("/api/finance/cash-reconciliation").then((r) => r.json()).then((d) => setPeriods(d.periods || [])); }, []);

  return (
    <div className="space-y-2">
      {periods.map((p) => (
        <div key={p.id} className="rounded-lg border border-border bg-surface shadow-[0_1px_2px_rgba(32,27,24,0.04),0_8px_24px_rgba(32,27,24,0.05)] px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-foreground font-semibold">{new Date(p.opened_at).toLocaleDateString("en-GB")}</p>
            <p className="text-muted-foreground text-sm">
              Opening {fmtMoney(p.opening_cash)} + Cash sales {fmtMoney(p.cash_sales)}
              {p.cash_tips > 0 && ` + Tips ${fmtMoney(p.cash_tips)}`} = Expected {fmtMoney(p.expected_cash)}
            </p>
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
            <BrowserPrintButton kind="zreport" id={p.id} className="px-3 py-1.5 rounded-lg border border-border text-sm font-semibold text-foreground hover:bg-surface-hover" />
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
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: "", contact_name: "", phone: "", email: "" });
  const [supplierError, setSupplierError] = useState("");

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
    if (!form.supplier_id || !form.amount) return;
    await fetch("/api/supplier-payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ supplier_id: Number(form.supplier_id), amount: Number(form.amount), method: form.method }) });
    setForm({ supplier_id: "", amount: "", method: "bank_transfer" });
    load();
  }

  async function saveSupplier() {
    setSupplierError("");
    if (!newSupplier.name.trim()) return setSupplierError("Supplier name is required.");
    const res = await fetch("/api/suppliers", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSupplier.name.trim(), contact_name: newSupplier.contact_name.trim() || null, phone: newSupplier.phone.trim() || null, email: newSupplier.email.trim() || null }),
    });
    const data = await res.json();
    if (!res.ok) return setSupplierError(data.error || "Failed to add supplier");
    setNewSupplier({ name: "", contact_name: "", phone: "", email: "" });
    setAddingSupplier(false);
    await loadSuppliers();
    setForm((f) => ({ ...f, supplier_id: String(data.supplier.id) }));
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
      <button onClick={() => setAddingSupplier((v) => !v)} className="mt-2 text-red-600 text-xs font-semibold">
        {addingSupplier ? "Cancel" : "+ New supplier not in the list?"}
      </button>
      {addingSupplier && (
        <div className="mt-2 rounded-lg border border-border bg-surface shadow-[0_1px_2px_rgba(32,27,24,0.04),0_8px_24px_rgba(32,27,24,0.05)] p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Supplier name" value={newSupplier.name} onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })} className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm col-span-2" />
            <input placeholder="Contact name" value={newSupplier.contact_name} onChange={(e) => setNewSupplier({ ...newSupplier, contact_name: e.target.value })} className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
            <input placeholder="Phone" value={newSupplier.phone} onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })} className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
            <input placeholder="Email" value={newSupplier.email} onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })} className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm col-span-2" />
          </div>
          {supplierError && <p className="text-red-600 text-xs">{supplierError}</p>}
          <button onClick={saveSupplier} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg">Add Supplier</button>
          <p className="text-muted-foreground text-xs">Full supplier management (edit, deactivate) lives in Inventory → Suppliers — this is just a quick add so you don&apos;t have to leave this screen.</p>
        </div>
      )}
      <div className="mt-4 space-y-1.5">
        {payments.map((p) => (
          <div key={p.id} className="flex justify-between text-sm rounded-lg border border-border bg-surface shadow-[0_1px_2px_rgba(32,27,24,0.04),0_8px_24px_rgba(32,27,24,0.05)] px-4 py-2">
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
  const [tab, setTab] = useState<"pnl" | "vat" | "cash" | "zreports" | "expenses" | "supplier_payments">("pnl");
  const tabs = [
    { id: "pnl", label: "Profit & Loss" },
    { id: "vat", label: "VAT" },
    { id: "cash", label: "Cash Reconciliation" },
    { id: "zreports", label: "Z Reports" },
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
          {tab === "cash" && <CashReconTab />}
          {tab === "zreports" && <ZReportsTab />}
          {tab === "expenses" && <ExpensesTab />}
          {tab === "supplier_payments" && <SupplierPaymentsTab />}
        </div>
      </div>
      </div>
    </>
  );
}
