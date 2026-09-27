import { isNearOpeningHours } from "@/lib/hours";

// Pacing for the till's always-on background checks (Print Station, new-order
// alerts). Each check is a Vercel function call, and the project is on the
// free plan (~1M calls / 4h CPU a month) — checking every few seconds around
// the clock on every open screen would blow through that and get the whole
// POS and website paused. So: full speed around opening hours, a check every
// couple of minutes otherwise (still catches the odd late/early order).
export const CLOSED_INTERVAL_MS = 2 * 60_000;

// True if a check is due now: always when near opening hours, otherwise only
// once CLOSED_INTERVAL_MS has passed since the last one.
export function checkDue(lastCheckAt: number, now: Date = new Date()): boolean {
  return isNearOpeningHours(now) || now.getTime() - lastCheckAt >= CLOSED_INTERVAL_MS;
}
