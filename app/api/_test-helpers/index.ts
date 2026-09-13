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
  // Only pass through the fields tests actually need — spreading the whole
  // RequestInit carries over `signal`, whose DOM-lib type (AbortSignal |
  // null | undefined) doesn't satisfy NextRequest's own RequestInit (no
  // null), which fails `tsc`/next build even though ts-jest let it through.
  return new NextRequest(url, { method: init.method, body: init.body, headers });
}
