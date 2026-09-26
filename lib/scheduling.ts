import { isRestaurantOpen, formatHoursForDate } from "./hours";

const MIN_LEAD_MINUTES = 20;
const MAX_ADVANCE_DAYS = 7;

// Validates a customer-requested pickup/delivery time: far enough ahead, not
// too far in the future, and within the restaurant's actual opening hours
// for that day (via lib/hours.ts's structured hours) — a scheduled order
// outside hours is rejected outright rather than left for staff to catch.
export function validateScheduledTime(scheduledFor: string): string | null {
  const time = new Date(scheduledFor);
  if (isNaN(time.getTime())) return "Invalid scheduled time";

  const now = new Date();
  const minutesAhead = (time.getTime() - now.getTime()) / 60_000;
  if (minutesAhead < MIN_LEAD_MINUTES) {
    return `Please choose a time at least ${MIN_LEAD_MINUTES} minutes from now`;
  }
  const daysAhead = minutesAhead / (60 * 24);
  if (daysAhead > MAX_ADVANCE_DAYS) {
    return `Please choose a time within the next ${MAX_ADVANCE_DAYS} days`;
  }
  if (!isRestaurantOpen(time)) {
    return `We're closed at that time — opening hours that day are ${formatHoursForDate(time)}`;
  }
  return null;
}

export { MIN_LEAD_MINUTES, MAX_ADVANCE_DAYS };

// How long before a scheduled slot the kitchen should start on it — matches
// the ETA windows quoted in the order-confirmation email (lib/email.ts):
// ~20-30 min for takeaway, ~45-60 min for delivery (extra time for the
// drive). Used both to reveal scheduled orders on the Kitchen Display and to
// hold their printed ticket back until then.
export const KITCHEN_LEAD_MINUTES: Record<string, number> = { takeaway: 30, delivery: 45 };
