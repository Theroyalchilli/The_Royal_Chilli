import { createHmac, timingSafeEqual } from "crypto";

// Signed "unsubscribe" links for marketing emails: /unsubscribe?c=<id>&k=<hmac>.
// No login needed, and nobody can unsubscribe someone else by guessing ids.

const SECRET = process.env.JWT_SECRET || "royal-chilli-pos-fallback-secret-key-2024";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://royal-chilli-pos.vercel.app";

export function unsubscribeKey(customerId: number): string {
  return createHmac("sha256", SECRET).update(`unsubscribe:${customerId}`).digest("base64url").slice(0, 16);
}

export function unsubscribeUrl(customerId: number): string {
  return `${SITE_URL}/unsubscribe?c=${customerId}&k=${unsubscribeKey(customerId)}`;
}

export function unsubscribeKeyValid(customerId: number, key: string): boolean {
  const expected = Buffer.from(unsubscribeKey(customerId));
  const given = Buffer.from(String(key || ""));
  return customerId > 0 && given.length === expected.length && timingSafeEqual(given, expected);
}
