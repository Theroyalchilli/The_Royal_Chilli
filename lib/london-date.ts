// UK calendar dates. Vercel runs in UTC and toISOString() is UTC, so during
// British Summer Time anything between midnight and 1am UK time used to land
// on the previous day (an order at 00:19 on the 27th was numbered and listed
// as the 26th). These work in Europe/London time, clock changes included.
// Safe to import in the browser.

const TZ = "Europe/London";

// "YYYY-MM-DD" for the UK date at `date`.
export function londonDateStr(date: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

// Minutes the UK is ahead of UTC at `date` (0 in winter, 60 in summer).
function londonOffsetMinutes(date: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60_000);
}

// The UTC instant of UK midnight at the start of `dateStr` ("YYYY-MM-DD").
function londonMidnightUtc(dateStr: string): Date {
  return londonWallTimeUtc(dateStr, 0);
}

// The UTC instant of `hour`:00 UK time on `dateStr`.
export function londonWallTimeUtc(dateStr: string, hour: number): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hour));
  // The UK offset at that moment — checked twice so a clock-change day is right.
  const first = new Date(guess.getTime() - londonOffsetMinutes(guess) * 60_000);
  return new Date(guess.getTime() - londonOffsetMinutes(first) * 60_000);
}

// [start, end] of a UK calendar day as UTC ISO strings, for created_at queries.
export function londonDayRangeUtc(dateStr: string): { start: string; end: string } {
  const start = londonMidnightUtc(dateStr);
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  const end = new Date(londonMidnightUtc(next).getTime() - 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

// ---------- trading day ----------
// The restaurant opens at 9am and closes around 2am, so a "day" for sales
// reports runs 5am to 5am UK time: Monday's report includes Monday night's
// orders after midnight. (Order numbers and Order History use the plain UK
// calendar date; the Z report runs per till shift.)
export const TRADING_DAY_START_HOUR = 5;

function nextDateStr(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

// The trading day ("YYYY-MM-DD") that `date` belongs to.
export function tradingDayStr(date: Date = new Date()): string {
  const today = londonDateStr(date);
  return date.getTime() < londonWallTimeUtc(today, TRADING_DAY_START_HOUR).getTime()
    ? londonDateStr(new Date(londonWallTimeUtc(today, 0).getTime() - 12 * 3600_000))
    : today;
}

// [start, end] of trading days `from`..`to` (inclusive) as UTC ISO strings.
export function tradingRangeUtc(from: string, to: string = from): { start: string; end: string } {
  return {
    start: londonWallTimeUtc(from, TRADING_DAY_START_HOUR).toISOString(),
    end: new Date(londonWallTimeUtc(nextDateStr(to), TRADING_DAY_START_HOUR).getTime() - 1).toISOString(),
  };
}

// "YYYY-MM-01" for the current UK month (new Date(y, m, 1).toISOString()
// lands on the last day of the previous month in summer time).
export function firstOfMonthStr(dateStr: string = londonDateStr()): string {
  return `${dateStr.slice(0, 8)}01`;
}
