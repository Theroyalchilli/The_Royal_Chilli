// Structured opening hours, matching the display text in lib/site-content.ts's
// contact.hours. Used only to gate whether "ASAP" ordering can be offered at
// checkout — kept separate from lib/scheduling.ts's validateScheduledTime,
// which deliberately does NOT check a chosen time against these hours (see
// the comment there: out-of-hours scheduled slots are a rare edge case staff
// can call the customer about). Minutes from midnight; 0 = Sunday.
const HOURS: Record<number, { open: number; close: number }> = {
  0: { open: 9 * 60, close: 23 * 60 }, // Sunday
  1: { open: 9 * 60, close: 23 * 60 }, // Monday
  2: { open: 9 * 60, close: 23 * 60 }, // Tuesday
  3: { open: 9 * 60, close: 23 * 60 }, // Wednesday
  4: { open: 9 * 60, close: 23 * 60 }, // Thursday
  5: { open: 11 * 60, close: 23 * 60 }, // Friday
  6: { open: 9 * 60, close: 23 * 60 }, // Saturday
};

export function isRestaurantOpen(date: Date = new Date()): boolean {
  const hours = HOURS[date.getDay()];
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes >= hours.open && minutes < hours.close;
}
