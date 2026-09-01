jest.mock("../supabase", () => ({
  __esModule: true,
  default: { from: () => ({ select: () => Promise.resolve({ data: null, error: null }) }) },
}));

import { buildReconciliationReport } from "@/lib/inventory";

describe("buildReconciliationReport", () => {
  const ingredients = [
    { id: 1, name: "Chicken", unit: "kg", cost_per_unit: 4 },
    { id: 2, name: "Rice", unit: "kg", cost_per_unit: 1 },
  ];

  it("computes exact variance value and GP gap for a known fixture", () => {
    // Chicken: sold theoretically needs 10kg, ledger says 12kg actually left -> 2kg over, £8 leak.
    // Rice: sold theoretically needs 20kg, ledger matches exactly -> no variance.
    const theoretical = new Map([[1, 10], [2, 20]]);
    const actual = new Map([[1, 12], [2, 20]]);
    const netSales = 200;

    const report = buildReconciliationReport("2026-08-01", "2026-08-07", netSales, ingredients, theoretical, actual);

    expect(report.cogs_theoretical).toBeCloseTo(10 * 4 + 20 * 1, 2); // 60
    expect(report.cogs_actual).toBeCloseTo(12 * 4 + 20 * 1, 2); // 68
    // gp_theoretical = (200-60)/200 = 70%, gp_actual = (200-68)/200 = 66%
    expect(report.gp_theoretical).toBeCloseTo(70, 1);
    expect(report.gp_actual).toBeCloseTo(66, 1);
    expect(report.gp_gap).toBeCloseTo(4, 1);

    const chickenLine = report.lines.find((l) => l.ingredient_id === 1)!;
    expect(chickenLine.variance_qty).toBeCloseTo(2, 3);
    expect(chickenLine.variance_value).toBeCloseTo(8, 2);

    const riceLine = report.lines.find((l) => l.ingredient_id === 2)!;
    expect(riceLine.variance_qty).toBe(0);
    expect(riceLine.variance_value).toBe(0);
  });

  it("sorts lines by absolute variance value, biggest leak first", () => {
    const theoretical = new Map([[1, 10], [2, 5]]);
    const actual = new Map([[1, 10.5], [2, 15]]); // chicken: £2 leak, rice: £10 leak
    const report = buildReconciliationReport("2026-08-01", "2026-08-07", 100, ingredients, theoretical, actual);
    expect(report.lines.map((l) => l.ingredient_id)).toEqual([2, 1]);
  });

  it("returns null GP figures when there are no net sales, instead of dividing by zero", () => {
    const report = buildReconciliationReport("2026-08-01", "2026-08-07", 0, ingredients, new Map(), new Map());
    expect(report.gp_theoretical).toBeNull();
    expect(report.gp_actual).toBeNull();
    expect(report.gp_gap).toBeNull();
    expect(report.lines).toEqual([]);
  });
});
