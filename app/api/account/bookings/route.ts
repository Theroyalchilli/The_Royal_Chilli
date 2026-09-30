import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import supabase from "@/lib/supabase";
import { bizDb } from "@/lib/business-db";
import { websiteBusinessId } from "@/lib/business";
import { getCustomerSessionFromRequest } from "@/lib/customer-auth";
import { sendReservationConfirmationEmail } from "@/lib/email";
import { isValidUkMobile } from "@/lib/utils";
import { getBusinessSetting } from "@/lib/business-settings";

const ACTIVE_STATUSES = ["pending", "confirmed", "seated"];

export async function GET(req: NextRequest) {
  const session = await getCustomerSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: bookings } = await supabase
    .from("reservations")
    .select("id, party_size, reservation_date, reservation_time, status, notes, deposit_amount, created_at")
    .eq("customer_id", session.id)
    .order("reservation_date", { ascending: false })
    .order("reservation_time", { ascending: false });

  return NextResponse.json({ bookings: bookings || [] });
}

// Authenticated version of /api/public/reservations — this one uses the
// logged-in customer's own id directly instead of matching by phone, so a
// booking always lands on their real account rather than risking a second,
// phone-matched customer row if their profile phone differs from what they
// type here (see lib/customers.ts:findOrCreateCustomerByPhone's docstring
// for the same concern on the public/guest path).
export async function POST(req: NextRequest) {
  try {
    const session = await getCustomerSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { phone, party_size, reservation_date, reservation_time, notes } = await req.json();
    if (!phone || !reservation_date || !reservation_time) {
      return NextResponse.json({ error: "Phone, date and time are required" }, { status: 400 });
    }
    if (!isValidUkMobile(phone)) {
      return NextResponse.json({ error: "Please enter a valid UK mobile number (starts with 07, 11 digits)" }, { status: 400 });
    }

    // An account books at its own business (the website it was made on).
    const db = bizDb(await websiteBusinessId(req.headers.get("host")));
    const { data: customer } = await db.from("customers").select("name, email, phone").eq("id", session.id).maybeSingle();
    if (!customer) return NextResponse.json({ error: "Please log in on this restaurant's own website to book." }, { status: 403 });

    // Backfill the profile's phone the same way a first-time checkout would,
    // without overwriting one that's already there.
    if (!customer.phone) {
      await supabase.from("customers").update({ phone: phone.trim() }).eq("id", session.id);
    }

    const { count: tableCount } = await db.from("restaurant_tables").select("*", { count: "exact", head: true });
    const { count: bookedCount } = await db
      .from("reservations")
      .select("*", { count: "exact", head: true })
      .eq("reservation_date", reservation_date)
      .eq("reservation_time", reservation_time)
      .in("status", ACTIVE_STATUSES);
    const isFull = (tableCount ?? 0) > 0 && (bookedCount ?? 0) >= (tableCount ?? 0);

    let depositAmount = 0;
    if (!isFull) {
      depositAmount = Number((await getBusinessSetting(db.businessId, "reservation_deposit_amount")) ?? 0) || 0;
    }

    const { data, error } = await db
      .from("reservations")
      .insert({
        customer_id: session.id,
        customer_name: customer.name,
        customer_phone: phone.trim(),
        customer_email: session.email,
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

    waitUntil(sendReservationConfirmationEmail(session.email, {
      customerName: customer.name,
      partySize: party_size ? Math.max(1, Number(party_size)) : 2,
      reservationDate: reservation_date,
      reservationTime: reservation_time,
      waitlisted: isFull,
      depositAmount,
    }));

    return NextResponse.json({ success: true, id: data.id, waitlisted: isFull, deposit_amount: depositAmount }, { status: 201 });
  } catch (error) {
    console.error("Account booking create error:", error);
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}
