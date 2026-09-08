// Structured opening hours, matching the display text in lib/site-content.ts's
// contact.hours. Gates ASAP ordering at checkout, and (via lib/scheduling.ts)
// constrains "Schedule for later" to real opening hours too. Minutes from
// midnight; 0 = Sunday.
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

export function getHoursForDate(date: Date): { open: number; close: number } {
  return HOURS[date.getDay()];
}

function minutesToTimeInputValue(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatTime12h(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

// Human-readable "9:00 AM – 11:00 PM" for error messages, matching the style
// already used in lib/site-content.ts's displayed hours.
export function formatHoursForDate(date: Date): string {
  const hours = getHoursForDate(date);
  return `${formatTime12h(hours.open)} – ${formatTime12h(hours.close)}`;
}

// Rounds `from` forward to the next quarter-hour plus a lead buffer, then
// rolls forward to the next day's opening time if that lands outside
// opening hours (before open, or at/after close). Used both to default the
// checkout page's "Schedule for later" fields and, indirectly, to validate
// a chosen time actually falls within hours.
export function nextValidScheduleSlot(from: Date, leadMinutes = 30): Date {
  const candidate = new Date(from.getTime() + leadMinutes * 60_000);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(Math.ceil(candidate.getMinutes() / 15) * 15);

  for (let i = 0; i < 8; i++) {
    const hours = getHoursForDate(candidate);
    const minutesOfDay = candidate.getHours() * 60 + candidate.getMinutes();
    if (minutesOfDay < hours.open) {
      candidate.setHours(Math.floor(hours.open / 60), hours.open % 60, 0, 0);
      return candidate;
    }
    if (minutesOfDay >= hours.close) {
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(0, 0, 0, 0);
      continue;
    }
    return candidate;
  }
  return candidate;
}

// Every valid quarter-hour slot for a given date, restricted to that day's
// opening hours — used to populate a <select> for "Schedule for later" so
// the picker can only ever offer a real, open time (an <input type="time">'s
// min/max only affects validation state, not what the native picker lets you
// scroll to, so it doesn't actually stop someone from choosing 2 AM). When
// `date` is today, slots also start no earlier than `leadMinutes` from now.
export function getScheduleSlotOptions(
  date: Date,
  now: Date = new Date(),
  leadMinutes = 20,
  intervalMinutes = 15
): { value: string; label: string }[] {
  const hours = getHoursForDate(date);
  let startMinutes = hours.open;
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    const earliestFromNow = now.getHours() * 60 + now.getMinutes() + leadMinutes;
    const rounded = Math.ceil(earliestFromNow / intervalMinutes) * intervalMinutes;
    startMinutes = Math.max(hours.open, rounded);
  }
  const options: { value: string; label: string }[] = [];
  for (let m = startMinutes; m < hours.close; m += intervalMinutes) {
    options.push({ value: minutesToTimeInputValue(m), label: formatTime12h(m) });
  }
  return options;
}

// Local (not UTC) YYYY-MM-DD / HH:MM — matches what <input type="date"/"time">
// expect, and avoids the UTC-shift bug of toISOString() near local midnight.
export function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function toTimeInputValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
