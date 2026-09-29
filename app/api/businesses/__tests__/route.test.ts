import type { SessionUser } from "@/lib/types";
jest.mock("@/lib/businesses-admin", () => ({
  __esModule: true,
  listBusinessSummaries: async () => [{ id: 1, name: "The Royal Chilli" }],
  createBusiness: async () => ({ ok: true, value: { id: 5, slug: "x" } }),
}));
jest.mock("@/lib/business-db", () => ({ __esModule: true, bizDb: () => ({ from: () => ({ insert: async () => ({ error: null }) }) }) }));

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/businesses/route";
import { authedRequest } from "@/app/api/_test-helpers";

const owner: SessionUser = { id: 26, name: "Owner", role: "admin", businessId: 1, owner: true };
const admin: SessionUser = { id: 1, name: "Royalchilli", role: "admin", businessId: 1 };

it("only the owner can list or add businesses", async () => {
  expect((await GET((await authedRequest("http://localhost/api/businesses", admin)) as NextRequest)).status).toBe(403);
  expect((await POST((await authedRequest("http://localhost/api/businesses", admin, { method: "POST", body: JSON.stringify({ name: "X", order_prefix: "XX" }) })) as NextRequest)).status).toBe(403);
  expect((await GET((await authedRequest("http://localhost/api/businesses", owner)) as NextRequest)).status).toBe(200);
  expect((await POST((await authedRequest("http://localhost/api/businesses", owner, { method: "POST", body: JSON.stringify({ name: "X", order_prefix: "XX" }) })) as NextRequest)).status).toBe(201);
});
