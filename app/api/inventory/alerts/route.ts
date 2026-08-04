import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageInventory } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageInventory(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: ingredients } = await supabase.from("ingredients").select("*").eq("active", 1);
  const lowStock = (ingredients || []).filter((i) => Number(i.current_stock) <= Number(i.reorder_level));

  const sevenDaysOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: expiringItems } = await supabase
    .from("purchase_order_items")
    .select("*, ingredient:ingredients(name, unit)")
    .not("expiry_date", "is", null)
    .lte("expiry_date", sevenDaysOut)
    .gte("expiry_date", new Date().toISOString().slice(0, 10));

  const flatExpiring = (expiringItems || []).map((i) => {
    const { ingredient: ing, ...rest } = i as typeof i & { ingredient: { name: string; unit: string } | null };
    return { ...rest, ingredient_name: ing?.name ?? null, unit: ing?.unit ?? null };
  });

  return NextResponse.json({ lowStock, expiringSoon: flatExpiring });
}
