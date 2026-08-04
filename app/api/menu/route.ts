import { NextResponse } from "next/server";
import supabase from "@/lib/supabase";

export async function GET() {
  try {
    const { data: categories, error: catError } = await supabase
      .from("menu_categories")
      .select("*")
      .eq("active", 1)
      .order("display_order");

    if (catError) throw catError;

    const { data: items, error: itemError } = await supabase
      .from("menu_items")
      .select(`
        *,
        menu_categories!inner(name, color)
      `)
      .eq("active", 1)
      .order("category_id")
      .order("display_order");

    if (itemError) throw itemError;

    // Same attach/group/option join used by lib/menu.ts's getActiveMenu (public
    // site) — the POS till needs this too so staff get prompted for required
    // choices (e.g. protein type) instead of silently skipping them.
    const itemIds = (items || []).map((i) => i.id);
    const { data: attachments } = itemIds.length > 0
      ? await supabase.from("menu_item_modifier_groups").select("menu_item_id, group_id, required, display_order").in("menu_item_id", itemIds).order("display_order")
      : { data: [] };
    const groupIds = [...new Set((attachments || []).map((a) => a.group_id))];
    const { data: groups } = groupIds.length > 0
      ? await supabase.from("modifier_groups").select("*").in("id", groupIds)
      : { data: [] };
    const { data: options } = groupIds.length > 0
      ? await supabase.from("modifier_options").select("*").in("group_id", groupIds).order("display_order")
      : { data: [] };

    const optionsByGroup = new Map<number, { id: number; name: string; price_delta: number }[]>();
    for (const o of options || []) {
      const list = optionsByGroup.get(o.group_id) || [];
      list.push({ id: o.id, name: o.name, price_delta: Number(o.price_delta) });
      optionsByGroup.set(o.group_id, list);
    }
    const groupsById = new Map((groups || []).map((g) => [g.id, g]));
    const modifierGroupsByItem = new Map<number, unknown[]>();
    for (const a of attachments || []) {
      const g = groupsById.get(a.group_id);
      if (!g) continue;
      const list = modifierGroupsByItem.get(a.menu_item_id) || [];
      list.push({
        id: g.id,
        name: g.name,
        selection_type: g.selection_type,
        min_select: g.min_select,
        max_select: g.max_select,
        required: !!a.required,
        options: optionsByGroup.get(g.id) || [],
      });
      modifierGroupsByItem.set(a.menu_item_id, list);
    }

    // Flatten the joined fields to match original shape
    const flatItems = (items ?? []).map((item) => {
      const { menu_categories: cat, ...rest } = item as typeof item & {
        menu_categories: { name: string; color: string };
      };
      return {
        ...rest,
        category_name: cat?.name ?? null,
        category_color: cat?.color ?? null,
        modifierGroups: modifierGroupsByItem.get(item.id) || [],
      };
    });

    return NextResponse.json({ categories, items: flatItems });
  } catch (error) {
    console.error("Menu fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch menu" }, { status: 500 });
  }
}
