import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { checkReaderPayment, sumupReference } from "@/lib/sumup";
import { getTillReader } from "@/lib/till-reader";

// Polls a till card-reader charge for its outcome. Response vocabulary matches
// what components/pos/PaymentModal.tsx's polling loop expects:
// "succeeded" / "canceled" / "requires_payment_method" (+ a `declined` flag
// that distinguishes "card was rejected" from "still waiting for the tap"),
// plus `reference` — what to store on the payment row.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const chargeId = req.nextUrl.searchParams.get("charge_id") || req.nextUrl.searchParams.get("payment_intent_id");
  if (!chargeId) {
    return NextResponse.json({ error: "charge_id is required" }, { status: 400 });
  }

  const waiting = { status: "requires_payment_method", amount_received: 0, declined: false, error_message: null, reference: null };
  const declined = (message: string) => ({ ...waiting, declined: true, error_message: message });

  try {
    const { provider } = await getTillReader();

    if (provider === "sumup") {
      // Always SumUp's own record — never the (unsigned) webhook — decides
      // that a payment succeeded.
      const result = await checkReaderPayment(chargeId);
      if (result.status === "successful") {
        return NextResponse.json({
          status: "succeeded",
          amount_received: result.amount,
          declined: false,
          error_message: null,
          reference: sumupReference(result.transactionId),
        });
      }
      if (result.status === "cancelled") return NextResponse.json({ ...waiting, status: "canceled" });
      if (result.status === "failed") return NextResponse.json(declined(result.message));

      // No transaction yet. The webhook may have reported a failure that
      // never became a transaction (reader timed out, customer cancelled on
      // the Solo) — a "failed" hint is safe to act on; it only stops waiting.
      const { data: event } = await supabase
        .from("sumup_reader_events")
        .select("status, failure_reason")
        .eq("client_transaction_id", chargeId)
        .maybeSingle();
      if (event?.status === "failed") return NextResponse.json(declined(event.failure_reason || "Payment didn't go through on the reader"));
      return NextResponse.json(waiting);
    }

    if (!stripe) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
    }
    const pi = await stripe.paymentIntents.retrieve(chargeId);
    if (pi.status === "succeeded") {
      return NextResponse.json({
        status: "succeeded",
        amount_received: (pi.amount_received ?? 0) / 100,
        declined: false,
        error_message: null,
        reference: pi.id,
      });
    }
    if (pi.status === "canceled") return NextResponse.json({ ...waiting, status: "canceled" });
    // requires_payment_method: either still waiting for the customer to
    // tap/insert, or the last attempt was declined (last_payment_error set).
    if (pi.last_payment_error) return NextResponse.json(declined(pi.last_payment_error.message || "Card declined"));
    return NextResponse.json(waiting);
  } catch (error) {
    console.error("Terminal status check error:", error);
    return NextResponse.json({ error: "Failed to check payment status" }, { status: 500 });
  }
}
