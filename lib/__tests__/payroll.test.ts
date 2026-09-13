let attendanceRows: Record<string, unknown>[];

jest.mock("../supabase", () => ({
  __esModule: true,
  default: {
    from: () => ({
      select: () => ({
        not: () => ({
          gte: () => ({
            lte: () => Promise.resolve({ data: attendanceRows, error: null }),
          }),
        }),
      }),
    }),
  },
}));

import { computeGrossPay, computeHoursForPeriod } from "@/lib/payroll";

describe("computeGrossPay", () => {
  it("adds bonuses, tips and holiday pay, and subtracts deductions", () => {
    expect(computeGrossPay({ base_pay: 200, bonuses: 20, tips: 15, deductions: 10, holiday_pay: 0 })).toBe(225);
  });

  it("rounds to the nearest penny", () => {
    expect(computeGrossPay({ base_pay: 100.005, bonuses: 0, tips: 0, deductions: 0, holiday_pay: 0 })).toBe(100.01);
  });

  it("handles an all-zero entry", () => {
    expect(computeGrossPay({ base_pay: 0, bonuses: 0, tips: 0, deductions: 0, holiday_pay: 0 })).toBe(0);
  });
});

describe("computeHoursForPeriod", () => {
  beforeEach(() => {
    attendanceRows = [];
  });

  it("converts net_work_seconds to hours per staff member", async () => {
    attendanceRows = [{ staff_id: 1, net_work_seconds: 3600 * 8 }];
    const hours = await computeHoursForPeriod("2026-01-01", "2026-01-07");
    expect(hours.get(1)).toBe(8);
  });

  it("sums multiple shifts for the same staff member across the period", async () => {
    attendanceRows = [
      { staff_id: 1, net_work_seconds: 3600 * 8 },
      { staff_id: 1, net_work_seconds: 3600 * 6 },
      { staff_id: 2, net_work_seconds: 3600 * 5 },
    ];
    const hours = await computeHoursForPeriod("2026-01-01", "2026-01-07");
    expect(hours.get(1)).toBe(14);
    expect(hours.get(2)).toBe(5);
  });

  it("returns an empty map when nobody worked in the period", async () => {
    const hours = await computeHoursForPeriod("2026-01-01", "2026-01-07");
    expect(hours.size).toBe(0);
  });
});
