import supabase from "@/lib/supabase";

export type MenuItemModifierOption = {
  id: number;
  name: string;
  price_delta: number;
};

export type MenuItemModifierGroup = {
  id: number;
  name: string;
  selection_type: "single" | "multiple";
  min_select: number;
  max_select: number | null;
  required: boolean;
  options: MenuItemModifierOption[];
};

export type MenuChannel = "pos" | "online";

export type MenuItem = {
  id: number;
  name: string;
  description: string | null;
  price: number; // the price for the requested channel (see getActiveMenu)
  is_veg: number;
  display_order: number;
  allergens: string[];
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  modifierGroups: MenuItemModifierGroup[];
};

export type MenuCategory = {
  id: number;
  name: string;
  display_order: number;
  items: MenuItem[];
};

// channel decides which price and which availability flag each item is read
// through: "pos" (default) is the in-house till / dine-in menu, "online" is the
// website collection/delivery menu. The returned `price` is already the correct
// one for that channel, and categories with no items for the channel are
// dropped.
export async function getActiveMenu(channel: MenuChannel = "pos"): Promise<MenuCategory[]> {
  const { data: categories, error: catErr } = await supabase
    .from("menu_categories")
    .select("id, name, display_order")
    .eq("active", 1)
    .order("display_order");
  if (catErr) throw catErr;

  const availabilityCol = channel === "online" ? "online_available" : "pos_available";
  const { data: items, error: itemErr } = await supabase
    .from("menu_items")
    .select("id, category_id, name, description, price, online_price, is_veg, display_order, allergens, calories, protein_g, carbs_g, fat_g")
    .eq("active", 1)
    .eq(availabilityCol, 1)
    .order("display_order");
  if (itemErr) throw itemErr;

  const { data: attachments } = await supabase
    .from("menu_item_modifier_groups")
    .select("menu_item_id, group_id, required, display_order")
    .order("display_order");
  const { data: groups } = await supabase.from("modifier_groups").select("*");
  const { data: options } = await supabase.from("modifier_options").select("*").order("display_order");

  const optionsByGroup = new Map<number, MenuItemModifierOption[]>();
  for (const o of options || []) {
    const list = optionsByGroup.get(o.group_id) || [];
    list.push({ id: o.id, name: o.name, price_delta: Number(o.price_delta) });
    optionsByGroup.set(o.group_id, list);
  }
  const groupsById = new Map((groups || []).map((g) => [g.id, g]));

  const modifierGroupsByItem = new Map<number, MenuItemModifierGroup[]>();
  for (const a of attachments || []) {
    const g = groupsById.get(a.group_id);
    if (!g) continue;
    const list = modifierGroupsByItem.get(a.menu_item_id) || [];
    list.push({
      id: g.id, name: g.name, selection_type: g.selection_type,
      min_select: g.min_select, max_select: g.max_select,
      required: !!a.required,
      options: optionsByGroup.get(g.id) || [],
    });
    modifierGroupsByItem.set(a.menu_item_id, list);
  }

  return (categories || [])
    .map((c) => ({
      ...c,
      items: (items || [])
        .filter((i) => i.category_id === c.id)
        .map(({ id, name, description, price, online_price, is_veg, display_order, allergens, calories, protein_g, carbs_g, fat_g }) => ({
          id, name, description,
          price: channel === "online" ? Number(online_price ?? price) : Number(price),
          is_veg, display_order,
          allergens: allergens || [],
          calories: calories ?? null,
          protein_g: protein_g !== null ? Number(protein_g) : null,
          carbs_g: carbs_g !== null ? Number(carbs_g) : null,
          fat_g: fat_g !== null ? Number(fat_g) : null,
          modifierGroups: modifierGroupsByItem.get(id) || [],
        })),
    }))
    .filter((c) => c.items.length > 0);
}
