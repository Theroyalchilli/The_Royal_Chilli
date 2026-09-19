import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import supabase from "@/lib/supabase";
import { findOrCreateCustomerByPhone } from "@/lib/customers";
import { sendReservationConfirmationEmail } from "@/lib/email";
import { isValidEmail } from "@/lib/utils";

const ACTIVE_STATUSES = ["pending", "confirmed", "seated"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customer_name, customer_phone, customer_email, party_size, reservation_date, reservation_time, notes, join_waitlist } = body;

    if (!customer_name || !customer_phone || !customer_email || !reservation_date || !reservation_time) {
      return NextResponse.json(
        { error: "Name, phone, email, date and time are required" },
        { status: 400 }
      );
    }
    if (!isValidEmail(customer_email)) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
    }

    // Real capacity check against the actual table count — not a guess.
    const { count: tableCount } = await supabase.from("restaurant_tables").select("*", { count: "exact", head: true });
    const { count: bookedCount } = await supabase
      .from("reservations")
      .select("*", { count: "exact", head: true })
      .eq("reservation_date", reservation_date)
      .eq("reservation_time", reservation_time)
      .in("status", ACTIVE_STATUSES);

    const isFull = (tableCount ?? 0) > 0 && (bookedCount ?? 0) >= (tableCount ?? 0);
    if (isFull && !join_waitlist) {
      return NextResponse.json({ full: true, message: "That time is fully booked. Would you like to join the waitlist instead?" });
    }

    const customerId = await findOrCreateCustomerByPhone(customer_phone, customer_name, customer_email);

    // Deposits only apply to an actually-held slot — not the waitlist, since
    // there's no table to hold yet.
    let depositAmount = 0;
    if (!isFull) {
      const { data: setting } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "reservation_deposit_amount")
        .maybeSingle();
      depositAmount = setting ? Number(setting.value) : 0;
    }

    const { data, error } = await supabase
      .from("reservations")
      .insert({
        customer_id: customerId,
        customer_name,
        customer_phone,
        customer_email: customer_email || null,
        party_size: party_size ? Math.max(1, Number(party_size)) : 2,
        reservation_date,
        reservation_time,
        notes: notes || null,
        source: "website",
        status: isFull ? "waitlisted" : "pending",
        deposit_amount: depositAmount,
      })
      .select("id")
      .single();
    if (error) throw error;

    waitUntil(sendReservationConfirmationEmail(customer_email, {
      customerName: customer_name,
      partySize: party_size ? Math.max(1, Number(party_size)) : 2,
      reservationDate: reservation_date,
      reservationTime: reservation_time,
      waitlisted: isFull,
      depositAmount,
    }));

    return NextResponse.json(
      { success: true, id: data.id, waitlisted: isFull, deposit_amount: depositAmount },
      { status: 201 }
    );
  } catch (error) {
    console.error("Public reservation create error:", error);
    return NextResponse.json({ error: "Failed to create reservation" }, { status: 500 });
  }
}
