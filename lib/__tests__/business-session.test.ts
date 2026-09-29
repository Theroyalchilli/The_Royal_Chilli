import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { createSession, getSessionFromRequest } from "@/lib/auth";
import { createTillToken, verifyTillToken } from "@/lib/till-device";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "royal-chilli-pos-fallback-secret-key-2024");
const reqWith = (token: string) => new NextRequest("http://localhost/", { headers: { cookie: `pos_session=${token}` } });

describe("session business", () => {
  it("keeps the business a login is working for", async () => {
    const token = await createSession({ id: 7, name: "Sam", role: "manager", businessId: 2 });
    expect(await getSessionFromRequest(reqWith(token))).toEqual({ id: 7, name: "Sam", role: "manager", businessId: 2 });
  });

  it("treats an older login (no business in it) as The Royal Chilli", async () => {
    const old = await new SignJWT({ id: 7, name: "Sam", role: "manager" }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(SECRET);
    expect((await getSessionFromRequest(reqWith(old)))?.businessId).toBe(1);
  });
});

describe("till business", () => {
  it("a paired till remembers its business", async () => {
    expect((await verifyTillToken(await createTillToken(3, 2)))?.businessId).toBe(2);
  });

  it("a till paired before multi-business is The Royal Chilli's", async () => {
    const old = await new SignJWT({ kind: "till_device", did: "abc", paired_by: 3 }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(SECRET);
    expect(await verifyTillToken(old)).toEqual({ deviceId: "abc", pairedBy: 3, businessId: 1 });
  });
});
