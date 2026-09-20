import { NextRequest, NextResponse } from "next/server";
import { verifyCustomerLogin } from "@/lib/customers";
import { createCustomerSession, getCustomerSessionCookieOptions } from "@/lib/customer-auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email?.trim() || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const result = await verifyCustomerLogin(email, password);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const token = await createCustomerSession({ id: result.customer.id, name: result.customer.name, email: result.customer.email! });
    const { name: cookieName, options } = getCustomerSessionCookieOptions();

    const response = NextResponse.json({ success: true, customer: { id: result.customer.id, name: result.customer.name, email: result.customer.email } });
    response.cookies.set(cookieName, token, options);
    return response;
  } catch (error) {
    console.error("Customer login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
