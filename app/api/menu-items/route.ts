import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageStaff } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageStaff(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabase
    .from("menu_items")
    .select("*, menu_categories(name)")
    .order("category_id")
    .order("display_order");
  if (error) return NextResponse.json({ error: "Failed to fetch menu items" }, { status: 500 });

  const flat = (data || []).map((i) => {
    const { menu_categories: c, ...rest } = i as typeof i & { menu_categories: { name: string } | null };
    return { ...rest, category_name: c?.name ?? null };
  });
  return NextResponse.json({ items: flat });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageStaff(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const { category_id, name, description, price, is_veg, allergens, calories, protein_g, carbs_g, fat_g } = body;
    if (!category_id || !name || price === undefined) {
      return NextResponse.json({ error: "category_id, name and price are required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("menu_items")
      .insert({
        category_id, name, description: description || null, price,
        is_veg: is_veg ? 1 : 0,
        allergens: allergens || [],
        calories: calories || null, protein_g: protein_g || null, carbs_g: carbs_g || null, fat_g: fat_g || null,
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, item: data }, { status: 201 });
  } catch (error) {
    console.error("Menu item create error:", error);
    return NextResponse.json({ error: "Failed to create menu item" }, { status: 500 });
  }
}
