import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();
    const staff = db
      .prepare("SELECT id, name, role FROM staff WHERE active = 1 ORDER BY name")
      .all();
    return NextResponse.json({ staff });
  } catch (error) {
    console.error("Staff fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch staff" }, { status: 500 });
  }
}
