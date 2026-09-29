import type { SessionUser } from "@/lib/types";

jest.mock("@/lib/business", () => ({
  __esModule: true,
  getBusiness: (id: number) => Promise.resolve([1, 2].includes(id) ? { id, name: id === 1 ? "The Royal Chilli" : "Melt House" } : null),
}));
jest.mock("@/lib/business-db", () => ({
  __esModule: true,
  bizDb: () => ({ from: () => ({ insert: () => Promise.resolve({ error: null }) }) }),
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/switch-business/route";
import { authedRequest } from "@/app/api/_test-helpers";
import { getSessionFromRequest } from "@/lib/auth";

const owner: SessionUser = { id: 9, name: "Owner", role: "admin", businessId: 1, owner: true };
const admin: SessionUser = { id: 1, name: "Royalchilli", role: "admin", businessId: 1 };

async function switchTo(user: SessionUser, businessId: number) {
  const req = await authedRequest("http://localhost/api/auth/switch-business", user, {
    method: "POST", body: JSON.stringify({ businessId }), headers: { "Content-Type": "application/json" },
  });
  return POST(req as NextRequest);
}

describe("POST /api/auth/switch-business", () => {
  it("lets the owner step into another business, keeping them the owner", async () => {
    const res = await switchTo(owner, 2);
    expect(res.status).toBe(200);
    const cookie = res.cookies.get("pos_session")!.value;
    const next = await getSessionFromRequest(new NextRequest("http://localhost/", { headers: { cookie: `pos_session=${cookie}` } }));
    expect(next).toMatchObject({ id: 9, businessId: 2, owner: true });
  });

  it("refuses a business's own admin — only the owner can switch", async () => {
    const res = await switchTo(admin, 2);
    expect(res.status).toBe(403);
    expect(res.cookies.get("pos_session")).toBeFalsy();
  });

  it("404s a business that doesn't exist", async () => {
    expect((await switchTo(owner, 99)).status).toBe(404);
  });
});
