const MIN_LEAD_MINUTES = 20;
const MAX_ADVANCE_DAYS = 7;

// Validates a customer-requested pickup/delivery time. Deliberately doesn't try to
// parse the website's informal opening-hours text (e.g. "Mon – Thu 9AM–11PM") against
// it — that's free-text copy, not structured data. Out-of-hours slots are rare edge
// cases staff can catch and call the customer about, same as any other business today.
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
  return null;
}
