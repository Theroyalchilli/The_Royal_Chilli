import { NextRequest, NextResponse } from "next/server";
import { bizDb } from "@/lib/business-db";
import { websiteBusinessId } from "@/lib/business";
import { isValidEmail } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email?.trim() || !isValidEmail(email)) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    // Re-subscribing with the same email is a no-op, not an error — the
    // visitor doesn't need to know or care whether they'd already signed up.
    // Each business has its own newsletter list — the website's business.
    const { error } = await bizDb(await websiteBusinessId(req.headers.get("host")))
      .from("newsletter_subscribers").upsert({ email: cleanEmail }, { onConflict: "business_id,email", ignoreDuplicates: true });
    if (error) {
      console.error("Newsletter subscribe error:", error);
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Newsletter subscribe error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
