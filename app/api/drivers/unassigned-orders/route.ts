import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageDrivers } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageDrivers(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, customer_name, customer_phone, customer_address, total, created_at")
    .eq("order_type", "delivery")
    .eq("delivery_status", "unassigned")
    .not("status", "in", '("cancelled")')
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });

  return NextResponse.json({ orders: data });
}
