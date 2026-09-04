import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { sumupConfigured, sumupMerchantCode, sumupFetch } from "@/lib/sumup";

type SumUpReaderCheckoutStatus = {
  status: "pending" | "successful" | "failed" | "cancelled";
  amount?: number;
  payment_failure_reason?: string;
};

// Polls a specific reader checkout via SumUp's Cloud API. Response is
// deliberately translated into the same status vocabulary the old Stripe
// Terminal route used ("succeeded" / "canceled" / "requires_payment_method")
// so components/pos/PaymentModal.tsx's polling loop needs no changes.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!sumupConfigured) {
    return NextResponse.json({ error: "SumUp is not configured" }, { status: 503 });
  }

  const checkoutId = req.nextUrl.searchParams.get("payment_intent_id");
  if (!checkoutId) {
    return NextResponse.json({ error: "payment_intent_id is required" }, { status: 400 });
  }

  try {
    const { data: setting } = await supabase.from("app_settings").select("value").eq("key", "sumup_reader_id").maybeSingle();
    const readerId = setting ? String(setting.value || "").trim() : "";
    if (!readerId) {
      return NextResponse.json({ error: "No card reader is configured" }, { status: 400 });
    }

    const checkout = await sumupFetch<SumUpReaderCheckoutStatus>(
      `/v0.1/merchants/${sumupMerchantCode}/readers/${readerId}/checkout/${checkoutId}`
    );

    if (checkout.status === "successful") {
      return NextResponse.json({ status: "succeeded", amount_received: checkout.amount ?? 0, declined: false, error_message: null });
    }
    if (checkout.status === "cancelled") {
      return NextResponse.json({ status: "canceled", amount_received: 0, declined: false, error_message: null });
    }
    if (checkout.status === "failed") {
      return NextResponse.json({
        status: "requires_payment_method",
        amount_received: 0,
        declined: true,
        error_message: checkout.payment_failure_reason || "Card declined",
      });
    }
    // "pending" — still waiting for the customer to tap/insert.
    return NextResponse.json({ status: "requires_payment_method", amount_received: 0, declined: false, error_message: null });
  } catch (error) {
    console.error("Terminal status check error:", error);
    return NextResponse.json({ error: "Failed to check payment status" }, { status: 500 });
  }
}
