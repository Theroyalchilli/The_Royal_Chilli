import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();
    const tables = db
      .prepare("SELECT * FROM restaurant_tables ORDER BY table_number")
      .all();
    return NextResponse.json({ tables });
  } catch (error) {
    console.error("Tables fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tables" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, status } = await req.json();
    const db = getDb();
    db.prepare("UPDATE restaurant_tables SET status = ? WHERE id = ?").run(
      status,
      id
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Table update error:", error);
    return NextResponse.json(
      { error: "Failed to update table" },
      { status: 500 }
    );
  }
}
