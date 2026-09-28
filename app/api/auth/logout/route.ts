import { NextRequest, NextResponse } from "next/server";
import { getSessionCookieOptions } from "@/lib/auth";
import { tillFromRequest } from "@/lib/till-device";

// Signs the person out. A paired till stays paired, so the next person just
// enters their PIN (/pin); `till` tells the page where to go.
export async function POST(req: NextRequest) {
  const { name: cookieName } = getSessionCookieOptions();
  const till = await tillFromRequest(req);
  const response = NextResponse.json({ success: true, till: !!till });
  response.cookies.delete(cookieName);
  return response;
}
