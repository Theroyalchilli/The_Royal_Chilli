import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

let staffRow: Record<string, unknown> | null;

jest.mock("@/lib/supabase", () => ({
  __esModule: true,
  default: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => Promise.resolve(staffRow ? { data: staffRow, error: null } : { data: null, error: new Error("not found") }),
          }),
        }),
      }),
    }),
  },
}));

import { POST } from "@/app/api/auth/login/route";

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  staffRow = {
    id: 1, name: "Test Manager", role: "manager", active: 1,
    password_hash: await bcrypt.hash("correct-horse", 10),
  };
});

describe("POST /api/auth/login", () => {
  it("400s when username or password is missing", async () => {
    const res = await POST(jsonRequest({ username: "manager1" }));
    expect(res.status).toBe(400);
  });

  it("logs in with correct credentials and sets the session cookie", async () => {
    const res = await POST(jsonRequest({ username: "manager1", password: "correct-horse" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toEqual({ id: 1, name: "Test Manager", role: "manager" });
    expect(res.cookies.get("pos_session")).toBeTruthy();
  });

  it("401s on a wrong password", async () => {
    const res = await POST(jsonRequest({ username: "manager1", password: "wrong" }));
    expect(res.status).toBe(401);
  });

  it("401s on an unknown username with the SAME message as a wrong password (no username enumeration)", async () => {
    staffRow = null;
    const unknownRes = await POST(jsonRequest({ username: "nobody", password: "whatever" }));
    const unknownBody = await unknownRes.json();

    staffRow = { id: 1, name: "Test Manager", role: "manager", active: 1, password_hash: await bcrypt.hash("correct-horse", 10) };
    const wrongPassRes = await POST(jsonRequest({ username: "manager1", password: "wrong" }));
    const wrongPassBody = await wrongPassRes.json();

    expect(unknownRes.status).toBe(401);
    expect(unknownBody.error).toBe(wrongPassBody.error);
  });
});
