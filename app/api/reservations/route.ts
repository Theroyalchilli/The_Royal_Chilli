import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const from = searchParams.get("from");
    const status = searchParams.get("status");

    let query = supabase
      .from("reservations")
      .select(`
        *,
        restaurant_tables(table_number)
      `)
      .order("reservation_date")
      .order("reservation_time");

    if (date) {
      query = query.eq("reservation_date", date);
    } else if (from) {
      // "Upcoming" view — everything from this date onward, no end cutoff.
      query = query.gte("reservation_date", from);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data: reservations, error } = await query;
    if (error) throw error;

    const flat = (reservations ?? []).map((r) => {
      const { restaurant_tables: rt, ...rest } = r as typeof r & {
        restaurant_tables: { table_number: string } | null;
      };
      return { ...rest, table_number: rt?.table_number ?? null };
    });

    return NextResponse.json({ reservations: flat });
  } catch (error) {
    console.error("Reservations fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch reservations" },
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

    const body = await req.json();
    const {
      customer_name,
      customer_phone,
      customer_email,
      party_size,
      reservation_date,
      reservation_time,
      table_id,
      notes,
      source,
    } = body;

    if (!customer_name || !reservation_date || !reservation_time) {
      return NextResponse.json(
        { error: "Customer name, date, and time are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("reservations")
      .insert({
        customer_name,
        customer_phone: customer_phone || null,
        customer_email: customer_email || null,
        party_size: party_size ?? 2,
        reservation_date,
        reservation_time,
        table_id: table_id || null,
        notes: notes || null,
        source: source || "website",
        status: "pending",
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, reservation: data }, { status: 201 });
  } catch (error) {
    console.error("Reservation create error:", error);
    return NextResponse.json(
      { error: "Failed to create reservation" },
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

    const { id, status, table_id, notes } = await req.json();

    if (!id || !status) {
      return NextResponse.json(
        { error: "Reservation ID and status are required" },
        { status: 400 }
      );
    }

    const validStatuses = ["pending", "confirmed", "seated", "cancelled", "no_show", "waitlisted"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, unknown> = { status };
    if (table_id !== undefined) updatePayload.table_id = table_id;
    if (notes !== undefined) updatePayload.notes = notes;

    const { data, error } = await supabase
      .from("reservations")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Update table status based on reservation status
    const reservation = data as { table_id: number | null };
    if (reservation.table_id) {
      if (status === "seated") {
        await supabase
          .from("restaurant_tables")
          .update({ status: "occupied" })
          .eq("id", reservation.table_id);
      } else if (status === "cancelled" || status === "no_show") {
        await supabase
          .from("restaurant_tables")
          .update({ status: "available" })
          .eq("id", reservation.table_id);
      }
    }

    return NextResponse.json({ success: true, reservation: data });
  } catch (error) {
    console.error("Reservation update error:", error);
    return NextResponse.json(
      { error: "Failed to update reservation" },
      { status: 500 }
    );
  }
}
