import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";

// Minimal, unauthenticated by design (same reasoning as GET /api/staff) —
// only used by the reservations page to check whether a deposit landed
// after a Stripe Checkout redirect, so it exposes nothing beyond that
// single boolean.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await supabase.from("reservations").select("deposit_paid_at").eq("id", id).single();
  if (!data) return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  return NextResponse.json({ paid: !!data.deposit_paid_at });
}
