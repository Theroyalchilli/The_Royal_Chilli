import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import supabase from "@/lib/supabase";
import { createSession, getSessionCookieOptions } from "@/lib/auth";
import { isManagerRole } from "@/lib/staff-pin";
import { createTillToken, tillCookieOptions, TILL_COOKIE } from "@/lib/till-device";
import type { Staff } from "@/lib/types";
import { loginBusinessId } from "@/lib/business";

export async function POST(req: NextRequest) {
  try {
    const { username, password, pair_till } = await req.json();

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

    const businessId = await loginBusinessId(staff.id, req.headers.get("host"));
    if (businessId == null) {
      return NextResponse.json({ error: "Your account isn't set up at any business yet — ask a manager." }, { status: 403 });
    }

    const token = await createSession({
      id: staff.id,
      name: staff.name,
      role: staff.role,
      businessId,
    });

    const { name: cookieName, options } = getSessionCookieOptions();

    const response = NextResponse.json({
      success: true,
      user: { id: staff.id, name: staff.name, role: staff.role, businessId },
    });

    response.cookies.set(cookieName, token, options);
    // "Set up this device as a till" — a manager pairs it once, then staff
    // sign in here with their PIN (lib/till-device.ts).
    if (pair_till && isManagerRole(staff.role)) {
      response.cookies.set(TILL_COOKIE, await createTillToken(staff.id, businessId), tillCookieOptions());
    }
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
