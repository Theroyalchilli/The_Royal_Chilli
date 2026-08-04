// These exercise the hardcoded DEFAULTS fallback in lib/permissions.ts, which is
// what's actually in effect here since there's no live Supabase to load real
// role_permissions rows from in a unit test. The DB-backed path (grant/revoke
// taking effect live) was verified against the real database when the Roles &
// Permissions feature was built — see that verification for the live-cache path.
jest.mock("../supabase", () => ({
  __esModule: true,
  default: { from: () => ({ select: () => Promise.resolve({ data: null, error: new Error("no db in unit tests") }) }) },
}));

import {
  canManageStaff,
  canManageInventory,
  canViewCrm,
  canManageCrm,
  canManageDrivers,
  canManageFinance,
} from "@/lib/permissions";

describe("permission defaults", () => {
  it("manage_staff: owner, admin, manager only", () => {
    expect(canManageStaff("owner")).toBe(true);
    expect(canManageStaff("admin")).toBe(true);
    expect(canManageStaff("manager")).toBe(true);
    expect(canManageStaff("cashier")).toBe(false);
    expect(canManageStaff("employee")).toBe(false);
  });

  it("manage_inventory: adds inventory_manager on top of staff managers", () => {
    expect(canManageInventory("inventory_manager")).toBe(true);
    expect(canManageInventory("manager")).toBe(true);
    expect(canManageInventory("cashier")).toBe(false);
  });

  it("view_crm: front-of-house roles can view, but not kitchen/driver", () => {
    expect(canViewCrm("cashier")).toBe(true);
    expect(canViewCrm("waiter")).toBe(true);
    expect(canViewCrm("supervisor")).toBe(true);
    expect(canViewCrm("kitchen")).toBe(false);
    expect(canViewCrm("driver")).toBe(false);
  });

  it("manage_crm: management only, narrower than view_crm", () => {
    expect(canManageCrm("manager")).toBe(true);
    expect(canManageCrm("cashier")).toBe(false);
    expect(canManageCrm("waiter")).toBe(false);
  });

  it("manage_drivers: management only", () => {
    expect(canManageDrivers("manager")).toBe(true);
    expect(canManageDrivers("driver")).toBe(false);
  });

  it("manage_finance: adds accountant on top of management", () => {
    expect(canManageFinance("accountant")).toBe(true);
    expect(canManageFinance("manager")).toBe(true);
    expect(canManageFinance("cashier")).toBe(false);
  });
});
