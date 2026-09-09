import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageStaff } from "@/lib/permissions";

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
    if (!session || !canManageStaff(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { table_number, capacity, location } = await req.json();

    const number = String(table_number ?? "").trim();
    if (!number) {
      return NextResponse.json({ error: "Table number is required" }, { status: 400 });
    }
    const seats = Math.round(Number(capacity));
    if (!Number.isFinite(seats) || seats < 1) {
      return NextResponse.json({ error: "Capacity must be at least 1" }, { status: 400 });
    }

    const { data: clash } = await supabase
      .from("restaurant_tables")
      .select("id")
      .eq("table_number", number)
      .maybeSingle();
    if (clash) {
      return NextResponse.json({ error: `Table "${number}" already exists` }, { status: 409 });
    }

    const { data, error } = await supabase
      .from("restaurant_tables")
      .insert({
        table_number: number,
        capacity: seats,
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

    // Floor staff flip `status` all shift; changing a table's number/capacity/
    // area is a manager-only setup action.
    const editsLayout = capacity !== undefined || location !== undefined || table_number !== undefined;
    if (editsLayout && !canManageStaff(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const updateFields: Record<string, unknown> = {};
    if (status !== undefined) updateFields.status = status;
    if (location !== undefined) updateFields.location = location;

    if (capacity !== undefined) {
      const seats = Math.round(Number(capacity));
      if (!Number.isFinite(seats) || seats < 1) {
        return NextResponse.json({ error: "Capacity must be at least 1" }, { status: 400 });
      }
      updateFields.capacity = seats;
    }

    if (table_number !== undefined) {
      const number = String(table_number).trim();
      if (!number) {
        return NextResponse.json({ error: "Table number is required" }, { status: 400 });
      }
      const { data: clash } = await supabase
        .from("restaurant_tables")
        .select("id")
        .eq("table_number", number)
        .neq("id", id)
        .maybeSingle();
      if (clash) {
        return NextResponse.json({ error: `Table "${number}" already exists` }, { status: 409 });
      }
      updateFields.table_number = number;
    }

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

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageStaff(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) {
      return NextResponse.json({ error: "Table id is required" }, { status: 400 });
    }

    // orders.table_id / reservations.table_id reference this row with no ON
    // DELETE rule — a table that's ever been used can't be removed without
    // orphaning history. Rename it instead.
    const [{ count: orderCount }, { count: resvCount }] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("table_id", id),
      supabase.from("reservations").select("id", { count: "exact", head: true }).eq("table_id", id),
    ]);
    if ((orderCount ?? 0) > 0 || (resvCount ?? 0) > 0) {
      return NextResponse.json(
        { error: "This table has order or booking history, so it can't be deleted — rename it if you're rearranging." },
        { status: 409 }
      );
    }

    const { error } = await supabase.from("restaurant_tables").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Table delete error:", error);
    return NextResponse.json({ error: "Failed to delete table" }, { status: 500 });
  }
}
