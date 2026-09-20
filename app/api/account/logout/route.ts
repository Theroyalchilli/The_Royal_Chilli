import { NextResponse } from "next/server";
import { getCustomerSessionCookieOptions } from "@/lib/customer-auth";

export async function POST() {
  const { name: cookieName } = getCustomerSessionCookieOptions();
  const response = NextResponse.json({ success: true });
  response.cookies.delete(cookieName);
  return response;
}
