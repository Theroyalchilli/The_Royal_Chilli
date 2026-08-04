import { validateScheduledTime } from "@/lib/scheduling";

const NOW = new Date("2026-07-25T12:00:00.000Z");

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(NOW);
});
afterEach(() => {
  jest.useRealTimers();
});

describe("validateScheduledTime", () => {
  it("rejects a time that can't be parsed", () => {
    expect(validateScheduledTime("not-a-date")).toMatch(/invalid/i);
  });

  it("rejects a time less than 20 minutes from now", () => {
    const tenMinutesAhead = new Date(NOW.getTime() + 10 * 60_000).toISOString();
    expect(validateScheduledTime(tenMinutesAhead)).toMatch(/at least 20 minutes/i);
  });

  it("rejects a time in the past", () => {
    const anHourAgo = new Date(NOW.getTime() - 60 * 60_000).toISOString();
    expect(validateScheduledTime(anHourAgo)).toMatch(/at least 20 minutes/i);
  });

  it("accepts a time exactly on the 20 minute boundary", () => {
    const exactlyTwentyMinutes = new Date(NOW.getTime() + 20 * 60_000).toISOString();
    expect(validateScheduledTime(exactlyTwentyMinutes)).toBeNull();
  });

  it("accepts a time comfortably within the window", () => {
    const twoHoursAhead = new Date(NOW.getTime() + 2 * 60 * 60_000).toISOString();
    expect(validateScheduledTime(twoHoursAhead)).toBeNull();
  });

  it("rejects a time more than 7 days ahead", () => {
    const eightDaysAhead = new Date(NOW.getTime() + 8 * 24 * 60 * 60_000).toISOString();
    expect(validateScheduledTime(eightDaysAhead)).toMatch(/within the next 7 days/i);
  });

  it("accepts a time exactly on the 7 day boundary", () => {
    const exactlySevenDays = new Date(NOW.getTime() + 7 * 24 * 60 * 60_000).toISOString();
    expect(validateScheduledTime(exactlySevenDays)).toBeNull();
  });
});
