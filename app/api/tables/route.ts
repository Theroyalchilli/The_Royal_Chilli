import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: tables, error } = await supabase
      .from("restaurant_tables")
      .select("*")
      .order("table_number");

    if (error) throw error;

    // Oldest active order per table = when it actually became occupied,
    // for the attention-SLA timer (not just the "occupied" status flag,
    // which a busy shift can forget to clear).
    const { data: activeOrders } = await supabase
      .from("orders")
      .select("table_id, created_at")
      .not("table_id", "is", null)
      .in("status", ["open", "sent_to_kitchen", "ready"])
      .order("created_at", { ascending: true });

    const occupiedSinceByTable = new Map<number, string>();
    for (const o of activeOrders || []) {
      if (o.table_id != null && !occupiedSinceByTable.has(o.table_id)) {
        occupiedSinceByTable.set(o.table_id, o.created_at);
      }
    }

    const tablesWithTiming = (tables || []).map((t) => ({
      ...t,
      occupied_since: occupiedSinceByTable.get(t.id) ?? null,
    }));

    return NextResponse.json({ tables: tablesWithTiming });
  } catch (error) {
    console.error("Tables fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tables" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { table_number, capacity, location } = await req.json();

    if (!table_number) {
      return NextResponse.json(
        { error: "Table number required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("restaurant_tables")
      .insert({
        table_number,
        capacity: capacity ?? 4,
        location: location ?? "main",
        status: "available",
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, table: data }, { status: 201 });
  } catch (error) {
    console.error("Table create error:", error);
    return NextResponse.json(
      { error: "Failed to create table" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, status, capacity, location, table_number } = await req.json();

    const updateFields: Record<string, unknown> = {};
    if (status !== undefined) updateFields.status = status;
    if (capacity !== undefined) updateFields.capacity = capacity;
    if (location !== undefined) updateFields.location = location;
    if (table_number !== undefined) updateFields.table_number = table_number;

    const { error } = await supabase
      .from("restaurant_tables")
      .update(updateFields)
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Table update error:", error);
    return NextResponse.json(
      { error: "Failed to update table" },
      { status: 500 }
    );
  }
}
