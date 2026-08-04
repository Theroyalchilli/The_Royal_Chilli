import supabase from "@/lib/supabase";

export type SelectedModifier = { id: number; name: string; price_delta: number };

export type ResolvedItem = {
  menuItemId: number;
  itemName: string;
  unitPrice: number; // base price + sum of selected modifier deltas
  selectedModifiers: SelectedModifier[];
};

// Looks up the real menu item + validates the client's modifier selections against
// what's actually attached to that item — quantities, names, and prices are never trusted
// from the client, same principle as menu item pricing elsewhere in the ordering flow.
export async function resolveItemWithModifiers(
  menuItemId: number,
  selectedOptionIds: number[]
): Promise<ResolvedItem> {
  const { data: menuItem } = await supabase.from("menu_items").select("id, name, price").eq("id", menuItemId).eq("active", 1).single();
  if (!menuItem) throw new Error(`Menu item ${menuItemId} is no longer available`);

  const { data: attachments } = await supabase
    .from("menu_item_modifier_groups")
    .select("group_id, required, modifier_groups(id, name, selection_type, min_select, max_select)")
    .eq("menu_item_id", menuItemId);

  const { data: allOptionsForItem } = await supabase
    .from("modifier_options")
    .select("id, group_id, name, price_delta")
    .in("group_id", (attachments || []).map((a) => a.group_id));

  const optionsById = new Map((allOptionsForItem || []).map((o) => [o.id, o]));
  const selectedByGroup = new Map<number, typeof allOptionsForItem>();
  for (const optId of selectedOptionIds) {
    const opt = optionsById.get(optId);
    if (!opt) throw new Error(`Invalid modifier selection for ${menuItem.name}`);
    const list = selectedByGroup.get(opt.group_id) || [];
    list.push(opt);
    selectedByGroup.set(opt.group_id, list);
  }

  for (const a of attachments || []) {
    const group = a.modifier_groups as unknown as { id: number; name: string; selection_type: string; min_select: number; max_select: number | null };
    const selected = selectedByGroup.get(group.id) || [];
    const count = selected.length;

    if (a.required && count === 0) {
      throw new Error(`Please choose an option for "${group.name}" on ${menuItem.name}`);
    }
    if (group.selection_type === "single" && count > 1) {
      throw new Error(`Only one option allowed for "${group.name}" on ${menuItem.name}`);
    }
    if (group.selection_type === "multiple") {
      if (count < group.min_select) {
        throw new Error(`Choose at least ${group.min_select} option(s) for "${group.name}" on ${menuItem.name}`);
      }
      if (group.max_select !== null && count > group.max_select) {
        throw new Error(`Choose at most ${group.max_select} option(s) for "${group.name}" on ${menuItem.name}`);
      }
    }
  }

  const selectedModifiers: SelectedModifier[] = selectedOptionIds.map((id) => {
    const opt = optionsById.get(id)!;
    return { id: opt.id, name: opt.name, price_delta: Number(opt.price_delta) };
  });

  const unitPrice = Math.round((Number(menuItem.price) + selectedModifiers.reduce((s, m) => s + m.price_delta, 0)) * 100) / 100;

  return { menuItemId, itemName: menuItem.name, unitPrice, selectedModifiers };
}
