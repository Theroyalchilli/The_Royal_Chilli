// Round numbers per table visit (Kitchen Display + kitchen tickets).
jest.mock("@/lib/supabase", () => ({ __esModule: true, default: {} }));
import { roundNumbers } from "@/lib/kitchen-rounds";

describe("roundNumbers", () => {
  it("numbers each table's tickets in the order they were sent", () => {
    const r = roundNumbers([
      { id: 12, table_id: 5, created_at: "2026-09-28T19:40:00Z" },
      { id: 10, table_id: 5, created_at: "2026-09-28T19:00:00Z" },
      { id: 11, table_id: 2, created_at: "2026-09-28T19:05:00Z" },
      { id: 13, table_id: 5, created_at: "2026-09-28T20:10:00Z" },
    ]);
    expect([r.get(10), r.get(12), r.get(13)]).toEqual([1, 2, 3]);
    expect(r.get(11)).toBe(1);
  });

  it("gives takeaway and delivery no round", () => {
    expect(roundNumbers([{ id: 1, table_id: null, created_at: "2026-09-28T19:00:00Z" }]).get(1)).toBeUndefined();
  });
});
