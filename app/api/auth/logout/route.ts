import { NextResponse } from "next/server";
import { getSessionCookieOptions } from "@/lib/auth";

export async function POST() {
  const { name: cookieName } = getSessionCookieOptions();
  const response = NextResponse.json({ success: true });
  response.cookies.delete(cookieName);
  return response;
}
