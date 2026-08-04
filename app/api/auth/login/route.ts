import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import supabase from "@/lib/supabase";
import { createSession, getSessionCookieOptions } from "@/lib/auth";
import type { Staff } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("staff")
      .select("*")
      .eq("username", username.trim().toLowerCase())
      .eq("active", 1)
      .single();

    if (error || !data || !data.password_hash) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const staff = data as Staff;
    const valid = await bcrypt.compare(password, staff.password_hash!);
    if (!valid) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const token = await createSession({
      id: staff.id,
      name: staff.name,
      role: staff.role,
    });

    const { name: cookieName, options } = getSessionCookieOptions();

    const response = NextResponse.json({
      success: true,
      user: { id: staff.id, name: staff.name, role: staff.role },
    });

    response.cookies.set(cookieName, token, options);
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
