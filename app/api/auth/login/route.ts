import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import getDb from "@/lib/db";
import { createSession, getSessionCookieOptions } from "@/lib/auth";
import type { Staff } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { name, pin } = await req.json();

    if (!name || !pin) {
      return NextResponse.json(
        { error: "Name and PIN required" },
        { status: 400 }
      );
    }

    const db = getDb();
    const staff = db
      .prepare(
        "SELECT * FROM staff WHERE name = ? AND active = 1"
      )
      .get(name) as Staff | undefined;

    if (!staff) {
      return NextResponse.json(
        { error: "Staff member not found" },
        { status: 401 }
      );
    }

    const valid = bcrypt.compareSync(pin, staff.pin_hash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
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
