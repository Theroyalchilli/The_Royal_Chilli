import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getTableByNumber } from "@/lib/dine-in";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tableNumber: string }> }
) {
  try {
    const { tableNumber } = await params;
    const table = await getTableByNumber(tableNumber);
    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    const { type } = await req.json();
    if (type !== "waiter" && type !== "bill") {
      return NextResponse.json({ error: "Invalid request type" }, { status: 400 });
    }

    const { error } = await supabase.from("table_requests").insert({
      table_id: table.id,
      type,
      status: "pending",
    });
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Table request error:", error);
    return NextResponse.json({ error: "Failed to send request" }, { status: 500 });
  }
}
