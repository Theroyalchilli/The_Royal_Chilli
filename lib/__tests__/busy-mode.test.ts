// Busy mode for website orders (set at the till).
import { busyOrderError, busyState, endOfTradingDay, NORMAL_MODE } from "@/lib/busy-mode";

const now = new Date("2026-09-28T19:00:00Z"); // Mon 20:00 BST
const inMin = (m: number) => new Date(now.getTime() + m * 60_000).toISOString();

describe("busyState", () => {
  it("is normal by default and after a pause or extra time has run out", () => {
    expect(busyState(NORMAL_MODE, now)).toEqual({ paused: false, pausedUntil: null, extraMinutes: 0 });
    expect(busyState({ paused_until: inMin(-1), extra_minutes: 30, extra_until: inMin(-1) }, now)).toEqual({ paused: false, pausedUntil: null, extraMinutes: 0 });
  });

  it("reports an active pause and extra time", () => {
    expect(busyState({ paused_until: inMin(30), extra_minutes: 15, extra_until: inMin(300) }, now)).toEqual({ paused: true, pausedUntil: inMin(30), extraMinutes: 15 });
  });

  it("'until closing' ends at the next 5am", () => {
    expect(endOfTradingDay(now)).toBe("2026-09-29T04:00:00.000Z");
  });
});

describe("busyOrderError", () => {
  const paused = { paused: true, pausedUntil: inMin(30), extraMinutes: 0 };
  it("refuses ASAP and too-early orders while paused, allows scheduling after", () => {
    expect(busyOrderError(paused, null, now)).toMatch(/paused until 20:30/);
    expect(busyOrderError(paused, inMin(15), now)).toMatch(/paused/);
    expect(busyOrderError(paused, inMin(30), now)).toBeNull();
  });

  it("with extra time, a scheduled order needs the longer lead time; ASAP is fine", () => {
    const extra = { paused: false, pausedUntil: null, extraMinutes: 30 };
    expect(busyOrderError(extra, inMin(40), now)).toMatch(/at least 50 minutes/);
    expect(busyOrderError(extra, inMin(55), now)).toBeNull();
    expect(busyOrderError(extra, null, now)).toBeNull();
  });
});
