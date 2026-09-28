import bcrypt from "bcryptjs";
import supabase from "@/lib/supabase";
import type { SessionUser } from "@/lib/types";

// 4-digit till PINs (staff.pin_hash, bcrypt). The till runs signed in all day
// (a manager logs in each morning); staff switch to themselves with a PIN so
// every order, payment, void, discount and Close Day is recorded against the
// right person (app/api/auth/pin). A manager's PIN also approves refunds.

export const PIN_PATTERN = /^\d{4}$/;
export const MANAGER_ROLES: SessionUser["role"][] = ["admin", "manager"];
export const isManagerRole = (role: string) => (MANAGER_ROLES as string[]).includes(role);

type PinStaff = { id: number; name: string; role: SessionUser["role"]; pin_hash: string | null };

// The active staff member whose PIN this is, or null. Checks every active
// staff member's hash (a handful of people), so PINs must be unique.
export async function findStaffByPin(pin: string, exceptId?: number): Promise<SessionUser | null> {
  if (!PIN_PATTERN.test(pin)) return null;
  const { data } = await supabase.from("staff").select("id, name, role, pin_hash").eq("active", 1).not("pin_hash", "is", null);
  for (const s of (data ?? []) as PinStaff[]) {
    if (s.id === exceptId || !s.pin_hash) continue;
    if (await bcrypt.compare(pin, s.pin_hash)) return { id: s.id, name: s.name, role: s.role };
  }
  return null;
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

// ---------- wrong-PIN throttle ----------
// 5 wrong tries lock the PIN pad for a minute, per signed-in till. Kept in
// memory (per server instance) — the PIN endpoint also requires the till to
// already be signed in, so it can't be tried from outside.
const LOCK_MS = 60_000;
const MAX_TRIES = 5;
const failures = new Map<string, { count: number; lockedUntil: number }>();

// Seconds left on a lock, or 0.
export function pinLockedFor(key: string, now = Date.now()): number {
  const f = failures.get(key);
  return f && f.lockedUntil > now ? Math.ceil((f.lockedUntil - now) / 1000) : 0;
}

export function recordPinFailure(key: string, now = Date.now()): void {
  const count = (failures.get(key)?.count ?? 0) + 1;
  failures.set(key, count >= MAX_TRIES ? { count: 0, lockedUntil: now + LOCK_MS } : { count, lockedUntil: 0 });
}

export function clearPinFailures(key: string): void {
  failures.delete(key);
}
