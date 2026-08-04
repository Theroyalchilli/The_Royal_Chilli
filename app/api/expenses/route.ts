import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageFinance } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageFinance(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supabase.from("expenses").select("*").order("expense_date", { ascending: false });
  if (from) query = query.gte("expense_date", from);
  if (to) query = query.lte("expense_date", to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
  return NextResponse.json({ expenses: data });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageFinance(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { category, description, amount, vat_applicable, expense_date, receipt_reference } = await req.json();
    if (!category || !description || !amount) {
      return NextResponse.json({ error: "category, description and amount are required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("expenses")
      .insert({
        category, description, amount,
        vat_applicable: vat_applicable === undefined ? 1 : Number(vat_applicable),
        expense_date: expense_date || new Date().toISOString().slice(0, 10),
        receipt_reference: receipt_reference || null,
        recorded_by: session.id,
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, expense: data }, { status: 201 });
  } catch (error) {
    console.error("Expense create error:", error);
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}
