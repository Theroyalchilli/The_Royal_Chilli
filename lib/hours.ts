// Structured opening hours, matching the display text in lib/site-content.ts's
// contact.hours. Gates ASAP ordering at checkout, and (via lib/scheduling.ts)
// constrains "Schedule for later" to real opening hours too. Minutes from
// midnight the shift STARTS on; 0 = Sunday. `close` can exceed 1440 (e.g.
// 1500 = 1:00 AM the next calendar day) for a shift that runs past midnight —
// every function below accounts for that.
const HOURS: Record<number, { open: number; close: number }> = {
  0: { open: 9 * 60, close: 25 * 60 }, // Sunday: 9:00 AM – 1:00 AM
  1: { open: 9 * 60, close: 25 * 60 }, // Monday
  2: { open: 9 * 60, close: 25 * 60 }, // Tuesday
  3: { open: 9 * 60, close: 25 * 60 }, // Wednesday
  4: { open: 9 * 60, close: 25 * 60 }, // Thursday
  5: { open: 9 * 60, close: 25 * 60 }, // Friday
  6: { open: 9 * 60, close: 25 * 60 }, // Saturday
};

export function getHoursForDate(date: Date): { open: number; close: number } {
  return HOURS[date.getDay()];
}

export function isRestaurantOpen(date: Date = new Date()): boolean {
  const minutesToday = date.getHours() * 60 + date.getMinutes();
  const today = getHoursForDate(date);
  if (minutesToday >= today.open && minutesToday < today.close) return true;

  // Today's own window can't cover the small hours (minutesToday is always
  // < 1440), so check whether *yesterday's* shift ran past midnight and is
  // still covering right now.
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  const prev = getHoursForDate(yesterday);
  if (prev.close > 1440 && minutesToday < prev.close - 1440) return true;

  return false;
}

function wrapMinutes(minutes: number): number {
  return ((minutes % 1440) + 1440) % 1440;
}

function formatTime12h(minutes: number): string {
  const wrapped = wrapMinutes(minutes);
  const h24 = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

// Human-readable "9:00 AM – 1:00 AM" for error messages, matching the style
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

// Local (not UTC) YYYY-MM-DD / HH:MM — matches what <input type="date"/"time">
// expect, and avoids the UTC-shift bug of toISOString() near local midnight.
export function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function toTimeInputValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
export function toDateTimeInputValue(date: Date): string {
  return `${toDateInputValue(date)}T${toTimeInputValue(date)}`;
}

// Every valid quarter-hour slot for a given date, restricted to that day's
// opening hours — used to populate a <select> for "Schedule for later" so
// the picker can only ever offer a real, open time (an <input type="time">'s
// min/max only affects validation state, not what the native picker lets you
// scroll to, so it doesn't actually stop someone from choosing 2 AM). When
// `date` is today, slots also start no earlier than `leadMinutes` from now.
//
// Each option's `value` is a full local "YYYY-MM-DDTHH:MM" — not just a time
// — because a slot past midnight (e.g. 12:30 AM) actually falls on the next
// calendar date from `date`. Using Date.setMinutes() to build it lets the
// day roll over correctly instead of silently mis-dating that order.
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
    const slotDate = new Date(date);
    slotDate.setHours(0, 0, 0, 0);
    slotDate.setMinutes(m); // rolls the Date into the next day when m >= 1440
    const label = formatTime12h(m) + (m >= 1440 ? " (next day)" : "");
    options.push({ value: toDateTimeInputValue(slotDate), label });
  }
  return options;
}
