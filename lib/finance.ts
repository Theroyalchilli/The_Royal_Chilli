import supabase from "@/lib/supabase";

export async function getVatRate(): Promise<number> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "vat_rate").maybeSingle();
  return data ? Number(data.value) : 0.2;
}

// Menu prices are VAT-inclusive, so the VAT portion of a gross figure is gross * (rate / (1 + rate)).
export function extractVat(grossAmount: number, vatRate: number): number {
  return Math.round(grossAmount * (vatRate / (1 + vatRate)) * 100) / 100;
}

export async function getRevenue(from: string, to: string): Promise<number> {
  const { data } = await supabase
    .from("orders")
    .select("total")
    .eq("status", "paid")
    .gte("created_at", `${from}T00:00:00.000Z`)
    .lte("created_at", `${to}T23:59:59.999Z`);
  return Math.round((data || []).reduce((s, o) => s + Number(o.total), 0) * 100) / 100;
}

export async function getIngredientPurchases(from: string, to: string): Promise<number> {
  const { data } = await supabase
    .from("purchase_orders")
    .select("total_cost")
    .eq("status", "received")
    .gte("received_date", from)
    .lte("received_date", to);
  return Math.round((data || []).reduce((s, po) => s + Number(po.total_cost), 0) * 100) / 100;
}

export async function getLabourCost(from: string, to: string): Promise<number> {
  const { data } = await supabase
    .from("payroll_entries")
    .select("gross_pay, payroll_periods!inner(period_start, period_end)")
    .gte("payroll_periods.period_start", from)
    .lte("payroll_periods.period_end", to);
  return Math.round((data || []).reduce((s, e) => s + Number(e.gross_pay), 0) * 100) / 100;
}

export async function getOtherExpenses(from: string, to: string): Promise<{ total: number; vatApplicableTotal: number }> {
  const { data } = await supabase
    .from("expenses")
    .select("amount, vat_applicable")
    .gte("expense_date", from)
    .lte("expense_date", to);
  const total = Math.round((data || []).reduce((s, e) => s + Number(e.amount), 0) * 100) / 100;
  const vatApplicableTotal = Math.round((data || []).filter((e) => e.vat_applicable).reduce((s, e) => s + Number(e.amount), 0) * 100) / 100;
  return { total, vatApplicableTotal };
}
