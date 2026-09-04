import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { sumupConfigured, sumupMerchantCode, sumupFetch, siteUrl } from "@/lib/sumup";

type SumUpCheckout = { id: string; hosted_checkout_url: string };

// Creates a SumUp Hosted Checkout for a reservation's deposit. Only
// meaningful when reservation_deposit_amount > 0 in Settings — the reservation
// itself already exists and is held either way.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!sumupConfigured) {
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

    const checkout = await sumupFetch<SumUpCheckout>("/v0.1/checkouts", {
      method: "POST",
      body: JSON.stringify({
        amount: Number(reservation.deposit_amount),
        currency: "GBP",
        merchant_code: sumupMerchantCode,
        checkout_reference: `reservation:${reservation.id}`,
        description: `The Royal Chilli — Reservation deposit (${reservation.reservation_date})`,
        redirect_url: `${siteUrl()}/reservations?deposit=return&reservation_id=${reservation.id}`,
        hosted_checkout: { enabled: true },
      }),
    });

    await supabase.from("reservations").update({ sumup_checkout_id: checkout.id }).eq("id", id);

    return NextResponse.json({ url: checkout.hosted_checkout_url });
  } catch (error) {
    console.error("Reservation checkout session create error:", error);
    return NextResponse.json({ error: "Failed to start deposit payment" }, { status: 500 });
  }
}
