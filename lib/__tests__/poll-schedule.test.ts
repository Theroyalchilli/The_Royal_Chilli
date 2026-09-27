// Background checks run at full speed only around opening hours (9am–1am,
// London time), to stay inside Vercel's free-plan limits.
import { checkDue, CLOSED_INTERVAL_MS } from "@/lib/poll-schedule";
import { isNearOpeningHours } from "@/lib/hours";

// 27 Sept 2026 is BST (UTC+1): 10:00 London = 09:00Z.
const london = (hhmm: string) => new Date(`2026-09-27T${hhmm}:00+01:00`);

describe("isNearOpeningHours", () => {
  it("is on while open, including past midnight until 1am", () => {
    expect(isNearOpeningHours(london("12:00"))).toBe(true);
    expect(isNearOpeningHours(london("00:40"))).toBe(true);
  });

  it("covers 30 minutes either side of opening and closing", () => {
    expect(isNearOpeningHours(london("08:40"))).toBe(true); // opens 9:00
    expect(isNearOpeningHours(london("01:20"))).toBe(true); // closed 1:00
  });

  it("is off in the dead of night", () => {
    expect(isNearOpeningHours(london("04:00"))).toBe(false);
  });
});

describe("checkDue", () => {
  it("always checks around opening hours", () => {
    const now = london("19:00");
    expect(checkDue(now.getTime() - 1000, now)).toBe(true);
  });

  it("checks only every couple of minutes when closed", () => {
    const now = london("04:00");
    expect(checkDue(now.getTime() - 5000, now)).toBe(false);
    expect(checkDue(now.getTime() - CLOSED_INTERVAL_MS, now)).toBe(true);
  });
});
