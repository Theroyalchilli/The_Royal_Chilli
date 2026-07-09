import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();

    const categories = db
      .prepare(
        "SELECT * FROM menu_categories WHERE active = 1 ORDER BY display_order"
      )
      .all();

    const items = db
      .prepare(
        `SELECT mi.*, mc.name as category_name, mc.color as category_color
         FROM menu_items mi
         JOIN menu_categories mc ON mi.category_id = mc.id
         WHERE mi.active = 1
         ORDER BY mi.category_id, mi.display_order`
      )
      .all();

    return NextResponse.json({ categories, items });
  } catch (error) {
    console.error("Menu fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch menu" }, { status: 500 });
  }
}
