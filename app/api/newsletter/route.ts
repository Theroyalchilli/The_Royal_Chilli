import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
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
    const { error } = await supabase.from("newsletter_subscribers").upsert({ email: cleanEmail }, { onConflict: "email", ignoreDuplicates: true });
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
