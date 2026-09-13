// Same mocking approach as order-totals.test.ts. resolveItemWithModifiers is
// the server-side guard that re-derives price/validity from the DB rather
// than trusting whatever the client sent, so these tests exercise exactly
// the cases a malicious or buggy client could try to abuse.

type Row = Record<string, unknown>;

let menuItemRow: Row | null;
let attachmentRows: Row[];
let optionRows: Row[];

jest.mock("../supabase", () => ({
  __esModule: true,
  default: {
    from: (table: string) => {
      if (table === "menu_items") {
        return { select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: menuItemRow, error: null }) }) }) }) };
      }
      if (table === "menu_item_modifier_groups") {
        return { select: () => ({ eq: () => Promise.resolve({ data: attachmentRows, error: null }) }) };
      }
      if (table === "modifier_options") {
        return { select: () => ({ in: () => Promise.resolve({ data: optionRows, error: null }) }) };
      }
      throw new Error(`Unexpected table in test: ${table}`);
    },
  },
}));

import { resolveItemWithModifiers } from "@/lib/modifiers";

function group(overrides: Partial<Row> = {}) {
  return { id: 1, name: "Spice Level", selection_type: "single", min_select: 1, max_select: null, ...overrides };
}

beforeEach(() => {
  menuItemRow = { id: 42, name: "Chicken Tikka", price: 10, online_price: 12 };
  attachmentRows = [];
  optionRows = [];
});

describe("resolveItemWithModifiers", () => {
  it("throws when the menu item isn't active/found", async () => {
    menuItemRow = null;
    await expect(resolveItemWithModifiers(42, [])).rejects.toThrow("no longer available");
  });

  it("uses the till price for the pos channel and online price for the online channel", async () => {
    const pos = await resolveItemWithModifiers(42, [], "pos");
    const online = await resolveItemWithModifiers(42, [], "online");
    expect(pos.unitPrice).toBe(10);
    expect(online.unitPrice).toBe(12);
  });

  it("rejects a modifier option id that isn't actually attached to this item", async () => {
    attachmentRows = [{ group_id: 1, required: false, modifier_groups: group() }];
    optionRows = [{ id: 5, group_id: 1, name: "Mild", price_delta: 0 }];
    await expect(resolveItemWithModifiers(42, [999])).rejects.toThrow("Invalid modifier selection");
  });

  it("requires a selection for a required group", async () => {
    attachmentRows = [{ group_id: 1, required: true, modifier_groups: group() }];
    optionRows = [{ id: 5, group_id: 1, name: "Mild", price_delta: 0 }];
    await expect(resolveItemWithModifiers(42, [])).rejects.toThrow('choose an option for "Spice Level"');
  });

  it("rejects more than one selection on a single-choice group", async () => {
    attachmentRows = [{ group_id: 1, required: false, modifier_groups: group({ selection_type: "single" }) }];
    optionRows = [
      { id: 5, group_id: 1, name: "Mild", price_delta: 0 },
      { id: 6, group_id: 1, name: "Hot", price_delta: 0 },
    ];
    await expect(resolveItemWithModifiers(42, [5, 6])).rejects.toThrow("Only one option allowed");
  });

  it("enforces min/max bounds on a multiple-choice group", async () => {
    attachmentRows = [{ group_id: 1, required: false, modifier_groups: group({ selection_type: "multiple", min_select: 1, max_select: 2 }) }];
    optionRows = [
      { id: 5, group_id: 1, name: "Cheese", price_delta: 1 },
      { id: 6, group_id: 1, name: "Bacon", price_delta: 1.5 },
      { id: 7, group_id: 1, name: "Egg", price_delta: 1 },
    ];
    await expect(resolveItemWithModifiers(42, [])).rejects.toThrow("Choose at least 1");
    await expect(resolveItemWithModifiers(42, [5, 6, 7])).rejects.toThrow("Choose at most 2");
    await expect(resolveItemWithModifiers(42, [5, 6])).resolves.toBeTruthy();
  });

  it("sums base price and selected modifier deltas", async () => {
    attachmentRows = [{ group_id: 1, required: false, modifier_groups: group({ selection_type: "multiple", min_select: 0, max_select: null }) }];
    optionRows = [
      { id: 5, group_id: 1, name: "Cheese", price_delta: 1.5 },
      { id: 6, group_id: 1, name: "Bacon", price_delta: 2 },
    ];
    const result = await resolveItemWithModifiers(42, [5, 6], "pos");
    expect(result.unitPrice).toBe(13.5);
    expect(result.selectedModifiers).toHaveLength(2);
  });
});
