import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { stripe, siteUrl } from "@/lib/stripe";

// Creates a Stripe Checkout Session for a reservation's deposit. Only
// meaningful when reservation_deposit_amount > 0 in Settings — the reservation
// itself already exists and is held either way. app/api/stripe/webhook marks
// the deposit paid off the metadata set here.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: "Online payment is not configured yet" }, { status: 503 });
    }

    const { id } = await params;
    const { data: reservation } = await supabase.from("reservations").select("*").eq("id", id).single();
    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }
    if (Number(reservation.deposit_amount) <= 0) {
      return NextResponse.json({ error: "No deposit is required for this reservation" }, { status: 400 });
    }
    if (reservation.deposit_paid_at) {
      return NextResponse.json({ error: "Deposit already paid" }, { status: 400 });
    }

    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: Math.round(Number(reservation.deposit_amount) * 100),
            product_data: { name: `The Royal Chilli — Reservation deposit (${reservation.reservation_date})` },
          },
        },
      ],
      metadata: { type: "reservation", reservation_id: String(reservation.id) },
      success_url: `${siteUrl()}/reservations?deposit=return&reservation_id=${reservation.id}`,
      cancel_url: `${siteUrl()}/reservations`,
      ...(reservation.customer_email ? { customer_email: reservation.customer_email } : {}),
    });

    await supabase.from("reservations").update({ stripe_session_id: checkout.id }).eq("id", id);

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error("Reservation checkout session create error:", error);
    return NextResponse.json({ error: "Failed to start deposit payment" }, { status: 500 });
  }
}
