import type { SessionUser } from "@/lib/types";

jest.mock("@/lib/supabase", () => ({
  __esModule: true,
  default: {
    from: (table: string) => {
      if (table === "menu_items") {
        return {
          insert: (vals: Record<string, unknown>) => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: 99, ...vals }, error: null }),
            }),
          }),
        };
      }
      if (table === "role_permissions") {
        return { select: () => Promise.resolve({ data: null, error: new Error("no db in unit tests") }) };
      }
      throw new Error(`Unexpected table in test: ${table}`);
    },
  },
}));

import { POST } from "@/app/api/menu-items/route";
import { authedRequest } from "@/app/api/_test-helpers";

const manager: SessionUser = { id: 2, name: "A Manager", role: "manager" };
const employee: SessionUser = { id: 3, name: "An Employee", role: "employee" };

async function post(user: SessionUser | null, body: unknown) {
  const req = await authedRequest("http://localhost/api/menu-items", user, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return POST(req);
}

describe("POST /api/menu-items", () => {
  it("creates an item for a manager with the required fields", async () => {
    const res = await post(manager, { category_id: 1, name: "Chicken Tikka", price: 9.95 });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.item).toMatchObject({ name: "Chicken Tikka", price: 9.95 });
  });

  it("400s when a required field is missing", async () => {
    const res = await post(manager, { category_id: 1, name: "Chicken Tikka" }); // no price
    expect(res.status).toBe(400);
  });

  it("401s an employee (front-line role, not staff management)", async () => {
    const res = await post(employee, { category_id: 1, name: "Chicken Tikka", price: 9.95 });
    expect(res.status).toBe(401);
  });

  it("401s an unauthenticated request", async () => {
    const res = await post(null, { category_id: 1, name: "Chicken Tikka", price: 9.95 });
    expect(res.status).toBe(401);
  });
});
