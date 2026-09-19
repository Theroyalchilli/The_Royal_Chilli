import { isRestaurantOpen, formatHoursForDate } from "@/lib/hours";

describe("isRestaurantOpen", () => {
  // Regression for the bug this fixed: the server (Vercel, UTC) used to read
  // a Date's own getHours()/getDay(), which is wrong for a UK business — a
  // 9:15am BST order arrived at the server as 08:15 and was rejected as
  // "closed" even though it was genuinely within the advertised 9am-1am
  // hours. isRestaurantOpen must resolve UK wall-clock time regardless of
  // the host process's own timezone.
  it("treats a BST morning instant as open, independent of process timezone", () => {
    // 2026-09-19 is within British Summer Time (UTC+1): 08:15 UTC = 9:15am BST.
    expect(isRestaurantOpen(new Date("2026-09-19T08:15:00.000Z"))).toBe(true);
  });

  it("treats the same BST day just before opening as closed", () => {
    // 07:30 UTC = 8:30am BST, before the 9am open.
    expect(isRestaurantOpen(new Date("2026-09-19T07:30:00.000Z"))).toBe(false);
  });

  it("treats BST late night before the 1am close as open (past-midnight rollover)", () => {
    // 23:30 UTC (previous calendar day) = 00:30 BST — after midnight, still
    // covered by the shift that started the day before.
    expect(isRestaurantOpen(new Date("2026-09-19T23:30:00.000Z"))).toBe(true);
  });

  it("treats BST time just after the 1am close as closed", () => {
    // 00:15 UTC = 01:15 BST — 15 minutes past close.
    expect(isRestaurantOpen(new Date("2026-09-20T00:15:00.000Z"))).toBe(false);
  });

  it("treats a GMT (winter, UTC+0) morning correctly too", () => {
    // 2026-01-19 is outside BST (GMT, UTC+0): 08:30 UTC = 8:30am GMT, before open.
    expect(isRestaurantOpen(new Date("2026-01-19T08:30:00.000Z"))).toBe(false);
    // 09:15 UTC = 9:15am GMT, after open.
    expect(isRestaurantOpen(new Date("2026-01-19T09:15:00.000Z"))).toBe(true);
  });
});

describe("formatHoursForDate", () => {
  it("formats the advertised hours", () => {
    expect(formatHoursForDate(new Date("2026-09-19T12:00:00.000Z"))).toBe("9:00 AM – 1:00 AM");
  });
});
