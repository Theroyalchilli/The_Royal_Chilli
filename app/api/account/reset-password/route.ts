import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import supabase from "@/lib/supabase";
import { verifyPasswordResetToken } from "@/lib/customer-auth";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (!token || !password) {
      return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
    }
    if (String(password).length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const customerId = await verifyPasswordResetToken(token);
    if (!customerId) {
      return NextResponse.json({ error: "This reset link is invalid or has expired" }, { status: 400 });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const { error } = await supabase.from("customers").update({ password_hash }).eq("id", customerId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset-password error:", error);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
