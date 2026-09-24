import { NextRequest } from "next/server";

// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically when
// the CRON_SECRET env var is set. Locally (no CRON_SECRET in .env.local) the
// check is skipped so these routes stay easy to hit by hand while testing —
// but in production, missing the secret fails CLOSED rather than silently
// leaving the route open to the public internet. If this ever logs, it means
// CRON_SECRET didn't make it into Vercel's production env vars.
export function isAuthorizedCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("CRON_SECRET is not set in production — refusing this cron request rather than leaving it open.");
      return false;
    }
    return true;
  }
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
