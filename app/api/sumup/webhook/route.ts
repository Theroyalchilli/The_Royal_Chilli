import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";

// SumUp calls this (the return_url of each till reader checkout) with the
// outcome: { event_type: "solo.transaction.updated", payload: {
// client_transaction_id, merchant_code, status: "successful" | "failed",
// failure_reason } }.
//
// SumUp doesn't sign these, so anyone could post here. It's only ever used as
// a hint — "stop waiting, it failed" — never to mark anything paid: success
// is always confirmed from SumUp's Transactions API with our own key
// (app/api/pos/terminal/status). Events for another merchant are ignored.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const p = body?.payload;
  if (body?.event_type !== "solo.transaction.updated" || !p?.client_transaction_id) {
    return NextResponse.json({ ok: true });
  }
  if (process.env.SUMUP_MERCHANT_CODE && p.merchant_code !== process.env.SUMUP_MERCHANT_CODE) {
    return NextResponse.json({ ok: true });
  }

  const status = p.status === "successful" ? "successful" : "failed";
  const { error } = await supabase.from("sumup_reader_events").upsert(
    {
      client_transaction_id: String(p.client_transaction_id).slice(0, 100),
      status,
      failure_reason: p.failure_reason ? String(p.failure_reason).slice(0, 300) : null,
      received_at: new Date().toISOString(),
    },
    { onConflict: "client_transaction_id" }
  );
  if (error) console.error("[sumup] failed to store webhook event:", error.message);
  return NextResponse.json({ ok: true });
}
