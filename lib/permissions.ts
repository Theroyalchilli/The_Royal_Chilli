import type { StaffRole } from "@/lib/types";
import supabase from "@/lib/supabase";

export const ALL_ROLES: StaffRole[] = [
  "owner", "admin", "manager", "supervisor", "cashier", "waiter",
  "chef", "kitchen", "driver", "inventory_manager", "accountant", "employee",
];

export const PERMISSION_KEYS = [
  "manage_staff",
  "manage_inventory",
  "view_crm",
  "manage_crm",
  "manage_drivers",
  "manage_finance",
  "approve_stock_takes",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  manage_staff: "Manage Staff (Staff Hub, payroll, rota, HR)",
  manage_inventory: "Manage Inventory (suppliers, stock, recipes)",
  view_crm: "View Customers (look up profile/points at till)",
  manage_crm: "Manage Customers (edit rewards, adjust points)",
  manage_drivers: "Manage Drivers (assign deliveries, roster)",
  manage_finance: "View Finance (P&L, VAT, cash reconciliation)",
  approve_stock_takes: "Approve Stock Takes (post submitted counts, adjust the ledger)",
};

// Same defaults that used to be hardcoded here. Used as the safety net if the
// role_permissions table can't be reached, so a DB hiccup fails closed to the
// previous known-good behavior rather than locking everyone out.
const DEFAULTS: Record<PermissionKey, StaffRole[]> = {
  manage_staff: ["owner", "admin", "manager"],
  manage_inventory: ["owner", "admin", "manager", "inventory_manager"],
  view_crm: ["owner", "admin", "manager", "supervisor", "cashier", "waiter"],
  manage_crm: ["owner", "admin", "manager"],
  manage_drivers: ["owner", "admin", "manager"],
  manage_finance: ["owner", "admin", "manager", "accountant"],
  approve_stock_takes: ["owner", "admin", "manager"],
};

function defaultsAsSets(): Record<PermissionKey, Set<StaffRole>> {
  return Object.fromEntries(
    PERMISSION_KEYS.map((k) => [k, new Set(DEFAULTS[k])])
  ) as Record<PermissionKey, Set<StaffRole>>;
}

let cache: Record<PermissionKey, Set<StaffRole>> | null = null;
let inFlight: Promise<void> | null = null;

async function loadCache(): Promise<void> {
  const { data, error } = await supabase
    .from("role_permissions")
    .select("role, permission, granted");

  if (error || !data) {
    cache = defaultsAsSets();
    return;
  }

  const next = Object.fromEntries(
    PERMISSION_KEYS.map((k) => [k, new Set<StaffRole>()])
  ) as Record<PermissionKey, Set<StaffRole>>;

  for (const row of data) {
    const key = row.permission as PermissionKey;
    if (row.granted && PERMISSION_KEYS.includes(key)) {
      next[key].add(row.role as StaffRole);
    }
  }
  cache = next;
}

// Called after any edit in the Settings UI so the new rules take effect
// immediately, and once eagerly on module load so the cache is warm.
export function refreshPermissionsCache(): Promise<void> {
  inFlight = loadCache().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

refreshPermissionsCache();

function has(key: PermissionKey, role: StaffRole): boolean {
  const set = cache?.[key];
  if (set) return set.has(role);
  return DEFAULTS[key].includes(role);
}

export function canManageStaff(role: StaffRole): boolean {
  return has("manage_staff", role);
}

export function canManageInventory(role: StaffRole): boolean {
  return has("manage_inventory", role);
}

export function canViewCrm(role: StaffRole): boolean {
  return has("view_crm", role);
}

export function canManageCrm(role: StaffRole): boolean {
  return has("manage_crm", role);
}

export function canManageDrivers(role: StaffRole): boolean {
  return has("manage_drivers", role);
}

export function canManageFinance(role: StaffRole): boolean {
  return has("manage_finance", role);
}

export function canApproveStockTakes(role: StaffRole): boolean {
  return has("approve_stock_takes", role);
}

// For the Settings UI: full matrix of every role x every permission, always
// fresh from the DB (bypasses the cache so the editor never shows stale state).
export async function getPermissionMatrix(): Promise<
  Record<PermissionKey, Record<StaffRole, boolean>>
> {
  const { data } = await supabase
    .from("role_permissions")
    .select("role, permission, granted");

  const matrix = Object.fromEntries(
    PERMISSION_KEYS.map((k) => [
      k,
      Object.fromEntries(ALL_ROLES.map((r) => [r, false])),
    ])
  ) as Record<PermissionKey, Record<StaffRole, boolean>>;

  for (const row of data || []) {
    const key = row.permission as PermissionKey;
    if (PERMISSION_KEYS.includes(key) && ALL_ROLES.includes(row.role as StaffRole)) {
      matrix[key][row.role as StaffRole] = !!row.granted;
    }
  }
  return matrix;
}
