// When a business is open — from its own opening hours (Settings → General →
// Opening hours; lib/opening-hours.ts), nothing written in code. Gates ASAP
// ordering at checkout, and (via lib/scheduling.ts) constrains "Schedule for
// later" and table-booking times too. Minutes from midnight the shift STARTS
// on; 0 = Sunday. `close` can exceed 1440 (e.g. 1500 = 1:00 AM the next
// calendar day) for a shift that runs past midnight — every function below
// accounts for that. A day with no hours (null) is closed.
export type DayWindow = { open: number; close: number };
export type WeekHours = Record<number, DayWindow | null>;

const DAY_INDEX: Record<string, number> = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
const toMinutes = (hhmm: string) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
};

/** The saved hours list ({ day: "Monday", open: "12:00", close: "01:00" }) as a week table. */
export function weekFromDayHours(list: { day: string; open: string; close: string }[] | null | undefined): WeekHours {
  const week: WeekHours = { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
  for (const h of list ?? []) {
    const d = DAY_INDEX[h.day];
    const open = toMinutes(h.open);
    let close = toMinutes(h.close);
    if (d === undefined || isNaN(open) || isNaN(close)) continue;
    if (close <= open) close += 1440; // runs past midnight
    week[d] = { open, close };
  }
  return week;
}

// The restaurant's hours are defined in UK wall-clock terms, so every check
// against them must resolve "what day/time is it" in Europe/London — never
// via a Date's own getDay()/getHours()/getMinutes(), which reflect whatever
// timezone the CODE happens to be running in. That's fine in a UK customer's
// browser (their local time already is UK time), but the server (Vercel's
// Node runtime defaults to UTC) would otherwise misread every check by an
// hour during BST, rejecting genuinely valid ASAP/scheduled orders — exactly
// the bug this fixed (a 9:15am BST order read as 8:15 server-side, before
// the 9am open). Resolving via Intl here makes the answer identical no
// matter where the check runs.
const LONDON_WEEKDAY_TO_GETDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function londonMinutesAndDay(date: Date): { minutesOfDay: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);
  const hourRaw = Number(parts.find((p) => p.type === "hour")!.value);
  const minute = Number(parts.find((p) => p.type === "minute")!.value);
  const weekday = parts.find((p) => p.type === "weekday")!.value;
  // Some engines report midnight as "24" with hour12:false.
  const hour = hourRaw === 24 ? 0 : hourRaw;
  return { minutesOfDay: hour * 60 + minute, day: LONDON_WEEKDAY_TO_GETDAY[weekday] ?? 0 };
}

// "What time is it right now, in London wall-clock terms" — a YYYY-MM-DD
// date string plus minute-of-day, both resolved via Intl so this is correct
// no matter what timezone the server process itself runs in (see the note
// above). Used to compare against DATE/TIME columns like reservations'
// reservation_date/reservation_time, which are entered in restaurant-local
// time, not UTC.
export function londonNowDateAndMinutes(date: Date = new Date()): { dateStr: string; minutesOfDay: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  const hourRaw = Number(get("hour"));
  const hour = hourRaw === 24 ? 0 : hourRaw;
  return {
    dateStr: `${get("year")}-${get("month")}-${get("day")}`,
    minutesOfDay: hour * 60 + Number(get("minute")),
  };
}

export function getHoursForDate(week: WeekHours, date: Date): DayWindow | null {
  return week[londonMinutesAndDay(date).day] ?? null;
}

export function isRestaurantOpen(week: WeekHours, date: Date = new Date()): boolean {
  const { minutesOfDay: minutesToday, day } = londonMinutesAndDay(date);
  const today = week[day];
  if (today && minutesToday >= today.open && minutesToday < today.close) return true;

  // Today's own window can't cover the small hours (minutesToday is always
  // < 1440), so check whether *yesterday's* shift ran past midnight and is
  // still covering right now.
  const prev = week[(day + 6) % 7];
  if (prev && prev.close > 1440 && minutesToday < prev.close - 1440) return true;

  return false;
}

// Open now, or within `bufferMinutes` of opening/closing — the window in
// which the till's background checks (Print Station, new-order alerts) run
// at full speed. Outside it they slow right down, to stay well inside
// Vercel's free-plan function limits (see lib/poll-schedule.ts).
export function isNearOpeningHours(week: WeekHours, date: Date = new Date(), bufferMinutes = 30): boolean {
  const ms = bufferMinutes * 60_000;
  return isRestaurantOpen(week, date) || isRestaurantOpen(week, new Date(date.getTime() + ms)) || isRestaurantOpen(week, new Date(date.getTime() - ms));
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
export function formatHoursForDate(week: WeekHours, date: Date): string {
  const hours = getHoursForDate(week, date);
  return hours ? `${formatTime12h(hours.open)} – ${formatTime12h(hours.close)}` : "Closed";
}

// Rounds `from` forward to the next quarter-hour plus a lead buffer, then
// rolls forward to the next day's opening time if that lands outside
// opening hours (before open, or at/after close). Used both to default the
// checkout page's "Schedule for later" fields and, indirectly, to validate
// a chosen time actually falls within hours.
export function nextValidScheduleSlot(week: WeekHours, from: Date, leadMinutes = 30): Date {
  const candidate = new Date(from.getTime() + leadMinutes * 60_000);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(Math.ceil(candidate.getMinutes() / 15) * 15);

  for (let i = 0; i < 8; i++) {
    const hours = getHoursForDate(week, candidate);
    const minutesOfDay = candidate.getHours() * 60 + candidate.getMinutes();
    if (!hours) {
      // Closed all day — try the next one.
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(0, 0, 0, 0);
      continue;
    }
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
  week: WeekHours,
  date: Date,
  now: Date = new Date(),
  leadMinutes = 20,
  intervalMinutes = 15
): { value: string; label: string }[] {
  const hours = getHoursForDate(week, date);
  if (!hours) return []; // closed that day
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
