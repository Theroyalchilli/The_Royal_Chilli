// UK calendar dates, including the summer-time hour after midnight and the
// clock-change days.
import { londonDateStr, londonDayRangeUtc } from "@/lib/london-date";

describe("londonDateStr", () => {
  it("puts 00:19 UK time on 27 Sept on the 27th (it's still the 26th in UTC)", () => {
    expect(londonDateStr(new Date("2026-09-26T23:19:58Z"))).toBe("2026-09-27");
  });

  it("matches UTC in winter", () => {
    expect(londonDateStr(new Date("2026-12-10T23:30:00Z"))).toBe("2026-12-10");
  });
});

describe("londonDayRangeUtc", () => {
  it("starts a summer day at 23:00 UTC the day before", () => {
    expect(londonDayRangeUtc("2026-09-27")).toEqual({ start: "2026-09-26T23:00:00.000Z", end: "2026-09-27T22:59:59.999Z" });
  });

  it("is plain UTC midnight to midnight in winter", () => {
    expect(londonDayRangeUtc("2026-12-10")).toEqual({ start: "2026-12-10T00:00:00.000Z", end: "2026-12-10T23:59:59.999Z" });
  });

  it("handles the clocks going back (25-hour day) and forward (23-hour day)", () => {
    expect(londonDayRangeUtc("2026-10-25")).toEqual({ start: "2026-10-24T23:00:00.000Z", end: "2026-10-25T23:59:59.999Z" });
    expect(londonDayRangeUtc("2026-03-29")).toEqual({ start: "2026-03-29T00:00:00.000Z", end: "2026-03-29T22:59:59.999Z" });
  });
});
