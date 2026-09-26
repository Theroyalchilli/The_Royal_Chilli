// SumUp Cloud API — drives the till's SumUp Solo card reader. Online payments
// stay on Stripe (lib/stripe.ts); this is only the in-person card reader.
//
// Flow: pair the Solo once (pairing code shown on the reader), then for each
// card payment push a checkout to it; the customer taps/inserts on the Solo.
// SumUp's webhook is NOT signed, so it's never trusted to mark anything paid:
// the outcome is always read back from SumUp's Transactions API with our key
// (checkReaderPayment below).
//
// Env (Vercel): SUMUP_API_KEY, SUMUP_MERCHANT_CODE, and an affiliate key
// (SUMUP_AFFILIATE_APP_ID + SUMUP_AFFILIATE_KEY), which SumUp requires on
// every reader checkout.

const API = "https://api.sumup.com";

export function sumupConfigured(): boolean {
  return !!(process.env.SUMUP_API_KEY && process.env.SUMUP_MERCHANT_CODE);
}

export class SumUpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T | null> {
  const key = process.env.SUMUP_API_KEY;
  if (!key) throw new SumUpError("SumUp isn't configured (SUMUP_API_KEY missing)", 503);
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = data?.message || data?.detail || data?.error_message || data?.title || `SumUp error ${res.status}`;
    throw new SumUpError(String(message), res.status);
  }
  return data as T;
}

function merchant(): string {
  const code = process.env.SUMUP_MERCHANT_CODE;
  if (!code) throw new SumUpError("SumUp isn't configured (SUMUP_MERCHANT_CODE missing)", 503);
  return encodeURIComponent(code);
}

export type SumUpReader = { id: string; name: string; status: string };

// Pairing code comes from the Solo: Connections → API → Connect.
export async function pairReader(pairingCode: string, name: string): Promise<SumUpReader> {
  const r = await call<SumUpReader>("POST", `/v0.1/merchants/${merchant()}/readers`, { pairing_code: pairingCode, name });
  if (!r) throw new SumUpError("SumUp didn't recognise that pairing code", 404);
  return { id: r.id, name: r.name, status: r.status };
}

// Pushes `amount` (GBP) to the reader. Returns SumUp's client_transaction_id,
// which identifies this payment from then on.
export async function startReaderCheckout(readerId: string, amount: number, returnUrl: string, description?: string): Promise<string> {
  const appId = process.env.SUMUP_AFFILIATE_APP_ID;
  const affiliateKey = process.env.SUMUP_AFFILIATE_KEY;
  if (!appId || !affiliateKey) {
    throw new SumUpError("SumUp affiliate key isn't configured (SUMUP_AFFILIATE_APP_ID / SUMUP_AFFILIATE_KEY)", 503);
  }
  const res = await call<{ data?: { client_transaction_id?: string } }>(
    "POST",
    `/v0.1/merchants/${merchant()}/readers/${encodeURIComponent(readerId)}/checkout`,
    {
      total_amount: { currency: "GBP", minor_unit: 2, value: Math.round(amount * 100) },
      affiliate: { app_id: appId, key: affiliateKey },
      return_url: returnUrl,
      ...(description ? { description } : {}),
    }
  );
  const id = res?.data?.client_transaction_id;
  if (!id) throw new SumUpError("The card reader didn't accept the payment — is it on and connected?", 502);
  return id;
}

// Stops whatever the reader is doing (customer changed their mind).
export async function cancelReaderCheckout(readerId: string): Promise<void> {
  await call("POST", `/v0.1/merchants/${merchant()}/readers/${encodeURIComponent(readerId)}/terminate`, {});
}

export type ReaderPaymentStatus =
  | { status: "pending" }
  | { status: "successful"; transactionId: string; amount: number }
  | { status: "failed"; message: string }
  | { status: "cancelled" };

type SumUpTransaction = { id: string; status: string; amount: number; transaction_code?: string };

// The authoritative outcome of a reader checkout, from SumUp's own records.
// No transaction yet = the customer hasn't presented a card.
export async function checkReaderPayment(clientTransactionId: string): Promise<ReaderPaymentStatus> {
  const t = await call<SumUpTransaction>(
    "GET",
    `/v2.1/merchants/${merchant()}/transactions?client_transaction_id=${encodeURIComponent(clientTransactionId)}`
  );
  return interpretTransaction(t);
}

export function interpretTransaction(t: SumUpTransaction | null): ReaderPaymentStatus {
  if (!t) return { status: "pending" };
  switch (t.status) {
    case "SUCCESSFUL":
      return { status: "successful", transactionId: t.id, amount: Number(t.amount) };
    case "FAILED":
      return { status: "failed", message: "Card declined — please try again" };
    case "CANCELLED":
      return { status: "cancelled" };
    default:
      return { status: "pending" };
  }
}

// Refunds `amount` (GBP) of a SumUp transaction back to the customer's card.
export async function refundTransaction(transactionId: string, amount: number): Promise<void> {
  await call("POST", `/v1.0/merchants/${merchant()}/payments/${encodeURIComponent(transactionId)}/refunds`, {
    amount: Math.round(amount * 100) / 100,
  });
}

// payments.reference for a SumUp reader payment — tells refunds which
// provider (and which transaction) to refund through.
export const SUMUP_REF_PREFIX = "sumup:";
export const sumupReference = (transactionId: string) => `${SUMUP_REF_PREFIX}${transactionId}`;
export const sumupTransactionFromReference = (ref: string | null) =>
  ref && ref.startsWith(SUMUP_REF_PREFIX) ? ref.slice(SUMUP_REF_PREFIX.length) : null;
