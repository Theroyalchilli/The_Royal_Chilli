import { NextRequest, NextResponse } from "next/server";
import { bizDb } from "@/lib/business-db";
import { websiteBusinessId } from "@/lib/business";
import { waitUntil } from "@vercel/functions";
import { createPasswordResetToken } from "@/lib/customer-auth";
import { sendPasswordResetEmail } from "@/lib/email";
import { siteUrl } from "@/lib/stripe";

// Always responds success regardless of whether the email matches an
// account — never lets this endpoint be used to probe which emails have one.
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email?.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // The account on this business's website.
    const { data: customer } = await bizDb(await websiteBusinessId(req.headers.get("host")))
      .from("customers")
      .select("id, name, email, password_hash")
      .ilike("email", email.trim().toLowerCase())
      // guest rows can share an email — only the account row has a password
      .not("password_hash", "is", null)
      .is("merged_into", null)
      .maybeSingle();

    if (customer?.password_hash) {
      const token = await createPasswordResetToken(customer.id);
      const resetUrl = `${siteUrl()}/account/reset-password?token=${token}`;
      waitUntil(sendPasswordResetEmail(customer.email, customer.name, resetUrl));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Forgot-password error:", error);
    return NextResponse.json({ success: true }); // still don't leak anything on error
  }
}
