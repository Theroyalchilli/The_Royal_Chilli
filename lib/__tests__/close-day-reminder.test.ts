// When the till's close-day reminder shows.
import { closeDayReminder } from "@/components/pos/CloseDayReminder";

const at = (iso: string) => new Date(iso);

describe("closeDayReminder", () => {
  it("flags a till opened on an earlier trading day", () => {
    // Opened Sat 26 Sept 23:21 BST; now Mon 28 Sept 19:00 BST.
    expect(closeDayReminder("2026-09-26T22:21:00Z", at("2026-09-28T18:00:00Z"))).toBe("stale");
  });

  it("stays quiet during service, including after midnight on the same trading day", () => {
    expect(closeDayReminder("2026-09-28T08:00:00Z", at("2026-09-28T19:00:00Z"))).toBeNull(); // Mon 20:00
    expect(closeDayReminder("2026-09-28T08:00:00Z", at("2026-09-28T23:30:00Z"))).toBeNull(); // Tue 00:30, still open
  });

  it("no longer nags at closing time on the same trading day", () => {
    expect(closeDayReminder("2026-09-28T08:00:00Z", at("2026-09-29T00:30:00Z"))).toBeNull(); // Tue 01:30
  });
});
