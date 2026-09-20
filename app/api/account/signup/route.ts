import { NextRequest, NextResponse } from "next/server";
import { signupCustomer } from "@/lib/customers";
import { createCustomerSession, getCustomerSessionCookieOptions } from "@/lib/customer-auth";
import { isValidEmail } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ error: "Name, email and password are required" }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
    }
    if (String(password).length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const result = await signupCustomer(name, email, password);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    const token = await createCustomerSession({ id: result.customer.id, name: result.customer.name, email: result.customer.email! });
    const { name: cookieName, options } = getCustomerSessionCookieOptions();

    const response = NextResponse.json({ success: true, customer: { id: result.customer.id, name: result.customer.name, email: result.customer.email } });
    response.cookies.set(cookieName, token, options);
    return response;
  } catch (error) {
    console.error("Customer signup error:", error);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}
