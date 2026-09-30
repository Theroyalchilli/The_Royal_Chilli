import { getBusinessSetting } from "@/lib/business-settings";

export type DayHours = { day: string; open: string; close: string };

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Each business's opening hours (Settings → General): shown on its website
// (footer, homepage badge, FAQ, schema.org) and — via lib/hours.ts — when it
// takes orders and bookings.
export async function getOpeningHours(businessId: number): Promise<DayHours[]> {
  const value = await getBusinessSetting(businessId, "opening_hours");
  const hours = (value as DayHours[] | undefined) ?? [];
  return [...hours].sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));
}

export function formatTime12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function formatDayHours(h: DayHours): string {
  return `${formatTime12h(h.open)} – ${formatTime12h(h.close)}`;
}

// Collapses to "Every day · 9:00 AM – 1:00 AM" when every day matches (the
// common case), otherwise lists each day individually.
export function summarizeOpeningHours(hours: DayHours[]): { day: string; time: string }[] {
  if (hours.length === 7 && hours.every((h) => h.open === hours[0].open && h.close === hours[0].close)) {
    return [{ day: "Every day", time: formatDayHours(hours[0]) }];
  }
  return hours.map((h) => ({ day: h.day, time: formatDayHours(h) }));
}
