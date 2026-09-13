// Regression coverage for the privilege-escalation fix: a manager/hr session
// must not be able to change role/active/password on any employee (including
// themselves) — only admin can. Everything else on the profile stays open to
// any canManageStaff role, exactly as before the fix.
import { NextRequest } from "next/server";
import type { SessionUser } from "@/lib/types";

let updatedRow: Record<string, unknown> | null;

jest.mock("@/lib/supabase", () => ({
  __esModule: true,
  default: {
    from: (table: string) => {
      if (table === "staff") {
        return {
          update: (vals: Record<string, unknown>) => ({
            eq: () => ({
              select: () => ({
                single: () => {
                  updatedRow = vals;
                  return Promise.resolve({ data: { id: 5, ...vals }, error: null });
                },
              }),
            }),
          }),
        };
      }
      if (table === "audit_logs") {
        return { insert: () => Promise.resolve({ data: null, error: null }) };
      }
      // lib/permissions.ts warms its role_permissions cache at import time
      // (refreshPermissionsCache()) — no live DB in a unit test, so let it
      // fall back to the hardcoded default matrix, same as permissions.test.ts.
      if (table === "role_permissions") {
        return { select: () => Promise.resolve({ data: null, error: new Error("no db in unit tests") }) };
      }
      throw new Error(`Unexpected table in test: ${table}`);
    },
  },
}));

import { PATCH } from "@/app/api/employees/[id]/route";
import { authedRequest } from "@/app/api/_test-helpers";

const manager: SessionUser = { id: 2, name: "A Manager", role: "manager" };
const admin: SessionUser = { id: 1, name: "An Admin", role: "admin" };

async function patch(user: SessionUser | null, targetId: string, body: unknown) {
  const req = await authedRequest(`http://localhost/api/employees/${targetId}`, user, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return PATCH(req as NextRequest, { params: Promise.resolve({ id: targetId }) });
}

beforeEach(() => {
  updatedRow = null;
});

describe("PATCH /api/employees/[id] — privilege-escalation guard", () => {
  it("403s a manager trying to change their own role", async () => {
    const res = await patch(manager, "2", { role: "admin" });
    expect(res.status).toBe(403);
    expect(updatedRow).toBeNull();
  });

  it("403s a manager trying to change another employee's active status", async () => {
    const res = await patch(manager, "5", { active: 0 });
    expect(res.status).toBe(403);
  });

  it("403s a manager trying to reset another employee's password", async () => {
    const res = await patch(manager, "1", { password: "newpassword123" });
    expect(res.status).toBe(403);
  });

  it("still lets a manager update ordinary profile fields", async () => {
    const res = await patch(manager, "5", { phone: "07700900000" });
    expect(res.status).toBe(200);
    expect(updatedRow).toEqual({ phone: "07700900000" });
  });

  it("lets an admin change role", async () => {
    const res = await patch(admin, "5", { role: "hr" });
    expect(res.status).toBe(200);
    expect(updatedRow).toEqual({ role: "hr" });
  });

  it("401s when there's no session at all", async () => {
    const res = await patch(null, "5", { phone: "07700900000" });
    expect(res.status).toBe(401);
  });
});
