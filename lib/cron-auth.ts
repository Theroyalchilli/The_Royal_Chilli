import { NextRequest } from "next/server";

// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically when
// the CRON_SECRET env var is set. If it isn't set (not configured yet), the
// check is skipped rather than locking the job out entirely — these jobs are
// self-guarding against duplicate awards either way, so an unauthenticated
// call is wasted compute at worst, not a double-award risk.
export function isAuthorizedCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
