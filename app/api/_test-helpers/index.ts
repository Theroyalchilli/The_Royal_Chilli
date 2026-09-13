// Shared helper for API route tests — builds a NextRequest carrying a real,
// signed session cookie (via lib/auth's own signing) so route handlers that
// call getSessionFromRequest() see a genuine session, not a stub.
import { NextRequest } from "next/server";
import { createSession, getSessionCookieOptions } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";

export async function authedRequest(url: string, user: SessionUser | null, init: RequestInit = {}): Promise<NextRequest> {
  const headers = new Headers(init.headers);
  if (user) {
    const token = await createSession(user);
    const { name } = getSessionCookieOptions();
    headers.set("cookie", `${name}=${token}`);
  }
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return new NextRequest(url, { ...init, headers });
}
