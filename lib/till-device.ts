import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";

// A "paired till": a device a manager has signed in on once with their
// password and ticked "set up as a till". It gets a long-lived pos_till
// cookie, and only a paired till accepts PIN sign-in (app/api/auth/pin-login)
// — so a 4-digit PIN can't be tried from any other browser on the internet.
// The token carries `kind`, never `role`, so it can't pass as a staff session
// (lib/auth.ts verify requires a role).

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "royal-chilli-pos-fallback-secret-key-2024"
);

export const TILL_COOKIE = "pos_till";
const TILL_MAX_AGE = 60 * 60 * 24 * 730; // 2 years

export type TillDevice = { deviceId: string; pairedBy: number };

export async function createTillToken(pairedBy: number): Promise<string> {
  return new SignJWT({ kind: "till_device", did: crypto.randomUUID(), paired_by: pairedBy })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("730d")
    .sign(JWT_SECRET);
}

export async function verifyTillToken(token: string | undefined): Promise<TillDevice | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, { algorithms: ["HS256"] });
    if (payload.kind !== "till_device" || typeof payload.did !== "string" || typeof payload.paired_by !== "number") return null;
    return { deviceId: payload.did, pairedBy: payload.paired_by };
  } catch {
    return null;
  }
}

export function tillFromRequest(req: NextRequest): Promise<TillDevice | null> {
  return verifyTillToken(req.cookies.get(TILL_COOKIE)?.value);
}

export function tillCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: TILL_MAX_AGE,
    path: "/",
  };
}
