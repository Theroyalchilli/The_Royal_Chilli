// Deliberately allowed to be unconfigured, same reasoning as lib/stripe.ts:
// online/terminal payment isn't required for the rest of the app to function
// until SUMUP_API_KEY + SUMUP_MERCHANT_CODE are actually set. Every call site
// must check `sumupConfigured` and fail gracefully rather than crash.
const SUMUP_API_KEY = process.env.SUMUP_API_KEY;
const SUMUP_MERCHANT_CODE = process.env.SUMUP_MERCHANT_CODE;

export const sumupConfigured = !!SUMUP_API_KEY && !!SUMUP_MERCHANT_CODE;
export const sumupMerchantCode = SUMUP_MERCHANT_CODE || "";

const SUMUP_API_BASE = "https://api.sumup.com";

// Thin wrapper — SumUp's REST API doesn't have an official first-party Node
// SDK we're relying on, so call it directly rather than add an unverified
// dependency. Throws on non-2xx so callers can just await + catch.
export async function sumupFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  if (!SUMUP_API_KEY) throw new Error("SumUp is not configured");

  const res = await fetch(`${SUMUP_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${SUMUP_API_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`SumUp API error ${res.status}: ${body || res.statusText}`);
  }

  return res.json() as Promise<T>;
}

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://royal-chilli-pos.vercel.app";
}
