"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { ALLERGENS } from "@/lib/allergens";

type Item = {
  id: number; category_id: number; category_name: string; name: string; description: string | null;
  price: number; online_price: number | null; is_veg: number; active: number; allergens: string[];
  pos_available: number; online_available: number;
  calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null;
};
type ModifierOption = { id?: number; name: string; price_delta: number };
type ModifierGroup = { id: number; name: string; selection_type: "single" | "multiple"; min_select: number; max_select: number | null; options: ModifierOption[] };
type Category = { id: number; name: string; color: string; display_order: number; active: number; item_count: number };

function fmtMoney(n: number) { return `£${Number(n).toFixed(2)}`; }

function ItemModifiersSection({ itemId, allGroups, onChanged }: { itemId: number; allGroups: ModifierGroup[]; onChanged: () => void }) {
  const [attached, setAttached] = useState<Map<number, boolean>>(new Map());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/menu-items/${itemId}/modifiers`).then((r) => r.json()).then((d) => {
      setAttached(new Map((d.attachments || []).map((a: { group_id: number; required: number }) => [a.group_id, !!a.required])));
      setLoaded(true);
    });
  }, [itemId]);

  async function save(next: Map<number, boolean>) {
    setAttached(next);
    await fetch(`/api/menu-items/${itemId}/modifiers`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attachments: Array.from(next.entries()).map(([group_id, required]) => ({ group_id, required })) }),
    });
    onChanged();
  }

  if (!loaded) return <p className="text-muted-foreground text-xs">Loading modifiers…</p>;
  if (allGroups.length === 0) return <p className="text-muted-foreground text-xs">No modifier groups yet — create one in the Modifier Groups tab first.</p>;

  return (
    <div className="space-y-1.5">
      {allGroups.map((g) => {
        const isAttached = attached.has(g.id);
        const required = attached.get(g.id) || false;
        return (
          <div key={g.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={isAttached} onChange={(e) => {
                const next = new Map(attached);
                if (e.target.checked) next.set(g.id, false); else next.delete(g.id);
                save(next);
              }} />
              {g.name}
            </label>
            {isAttached && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" checked={required} onChange={(e) => { const next = new Map(attached); next.set(g.id, e.target.checked); save(next); }} />
                Required
              </label>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ItemModal({ item, categoryOptions, allGroups, defaultCategoryId, onClose, onSaved }: {
  item: Item | "new"; categoryOptions: { id: number; name: string }[]; allGroups: ModifierGroup[]; defaultCategoryId?: number; onClose: () => void; onSaved: () => void;
}) {
  const isNew = item === "new";
  const [form, setForm] = useState({
    category_id: isNew ? defaultCategoryId ?? categoryOptions[0]?.id ?? 0 : item.category_id,
    name: isNew ? "" : item.name,
    description: isNew ? "" : item.description || "",
    price: isNew ? "" : String(item.price),
    online_price: isNew ? "" : item.online_price != null ? String(item.online_price) : "",
    pos_available: isNew ? true : !!item.pos_available,
    online_available: isNew ? true : !!item.online_available,
    is_veg: isNew ? false : !!item.is_veg,
    allergens: isNew ? [] : item.allergens,
    calories: isNew ? "" : item.calories !== null ? String(item.calories) : "",
    protein_g: isNew ? "" : item.protein_g !== null ? String(item.protein_g) : "",
    carbs_g: isNew ? "" : item.carbs_g !== null ? String(item.carbs_g) : "",
    fat_g: isNew ? "" : item.fat_g !== null ? String(item.fat_g) : "",
  });
  const { toast } = useToast();
  const [savedItemId, setSavedItemId] = useState<number | null>(isNew ? null : item.id);

  function toggleAllergen(a: string) {
    setForm((f) => ({ ...f, allergens: f.allergens.includes(a) ? f.allergens.filter((x) => x !== a) : [...f.allergens, a] }));
  }

  async function save() {
    if (!form.name.trim() || !form.price) return toast({ variant: "destructive", title: "Name and till price are required" });
    const payload = {
      category_id: form.category_id, name: form.name.trim(), description: form.description.trim() || null,
      price: Number(form.price),
      online_price: form.online_price ? Number(form.online_price) : null,
      pos_available: form.pos_available ? 1 : 0,
      online_available: form.online_available ? 1 : 0,
      is_veg: form.is_veg ? 1 : 0, allergens: form.allergens,
      calories: form.calories ? Number(form.calories) : null,
      protein_g: form.protein_g ? Number(form.protein_g) : null,
      carbs_g: form.carbs_g ? Number(form.carbs_g) : null,
      fat_g: form.fat_g ? Number(form.fat_g) : null,
    };
    const res = isNew
      ? await fetch("/api/menu-items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch(`/api/menu-items/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) return toast({ variant: "destructive", title: "Couldn't save item", description: data.error });
    toast({ variant: "success", title: isNew ? "Item created" : "Item saved", description: form.name.trim() });
    onSaved();
    if (isNew) setSavedItemId(data.item.id);
    else onClose();
  }

  async function toggleActive() {
    if (isNew || !savedItemId) return;
    const res = await fetch(`/api/menu-items/${savedItemId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: (item as Item).active ? 0 : 1 }) });
    if (!res.ok) {
      const data = await res.json();
      return toast({ variant: "destructive", title: "Couldn't update item", description: data.error });
    }
    toast({ variant: "success", title: (item as Item).active ? "Item deactivated" : "Item reactivated" });
    onSaved(); onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5">
        <h2 style={{ fontFamily: "var(--font-space-grotesk)" }} className="text-foreground font-bold text-lg">{isNew ? "New Menu Item" : item.name}</h2>
        <div className="mt-4 space-y-2">
          <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: Number(e.target.value) })} className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm">
            {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
          <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-muted-foreground text-xs">Till price (dine-in)</label>
              <input type="number" step="0.01" placeholder="0.00" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="mt-1 w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
            </div>
            <div>
              <label className="text-muted-foreground text-xs">Website price</label>
              <input type="number" step="0.01" placeholder="same as till" value={form.online_price} onChange={(e) => setForm({ ...form, online_price: e.target.value })} className="mt-1 w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={form.pos_available} onChange={(e) => setForm({ ...form, pos_available: e.target.checked })} /> On till menu</label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={form.online_available} onChange={(e) => setForm({ ...form, online_available: e.target.checked })} /> On website menu</label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={form.is_veg} onChange={(e) => setForm({ ...form, is_veg: e.target.checked })} /> Veg</label>
          </div>

          <div>
            <label className="text-muted-foreground text-xs">Allergens</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {ALLERGENS.map((a) => (
                <button key={a} onClick={() => toggleAllergen(a)}
                  className={`px-2 py-1 rounded-lg text-xs font-medium capitalize border ${form.allergens.includes(a) ? "bg-amber-100 border-amber-300 text-amber-700" : "bg-surface-hover border-border text-muted-foreground"}`}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-muted-foreground text-xs">Nutrition (per portion, optional)</label>
            <div className="mt-1 grid grid-cols-4 gap-2 text-xs">
              <input type="number" placeholder="kcal" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })} className="bg-surface-hover border border-border rounded-lg px-2 py-1.5 text-foreground" />
              <input type="number" placeholder="protein g" value={form.protein_g} onChange={(e) => setForm({ ...form, protein_g: e.target.value })} className="bg-surface-hover border border-border rounded-lg px-2 py-1.5 text-foreground" />
              <input type="number" placeholder="carbs g" value={form.carbs_g} onChange={(e) => setForm({ ...form, carbs_g: e.target.value })} className="bg-surface-hover border border-border rounded-lg px-2 py-1.5 text-foreground" />
              <input type="number" placeholder="fat g" value={form.fat_g} onChange={(e) => setForm({ ...form, fat_g: e.target.value })} className="bg-surface-hover border border-border rounded-lg px-2 py-1.5 text-foreground" />
            </div>
          </div>

          <div>
            <label className="text-muted-foreground text-xs">Modifiers</label>
            <div className="mt-1">
              {savedItemId ? (
                <ItemModifiersSection itemId={savedItemId} allGroups={allGroups} onChanged={onSaved} />
              ) : (
                <p className="text-muted-foreground text-xs">Save the item first, then attach modifier groups.</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button onClick={onClose} className="flex-1 h-10 bg-elevated hover:bg-elevated-hover text-foreground font-semibold rounded-xl">{savedItemId && isNew ? "Done" : "Cancel"}</button>
          {!isNew && <button onClick={toggleActive} className="flex-1 h-10 bg-elevated hover:bg-elevated-hover text-foreground font-semibold rounded-xl text-sm">{item.active ? "Deactivate" : "Reactivate"}</button>}
          <button onClick={save} className="flex-1 h-10 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl">Save</button>
        </div>
      </div>
    </div>
  );
}

function GroupModal({ group, onClose, onSaved }: { group: ModifierGroup | "new"; onClose: () => void; onSaved: () => void }) {
  const isNew = group === "new";
  const [name, setName] = useState(isNew ? "" : group.name);
  const [selectionType, setSelectionType] = useState<"single" | "multiple">(isNew ? "single" : group.selection_type);
  const [maxSelect, setMaxSelect] = useState(isNew ? "" : group.max_select !== null ? String(group.max_select) : "");
  const [options, setOptions] = useState<ModifierOption[]>(isNew ? [{ name: "", price_delta: 0 }] : group.options.map((o) => ({ ...o })));
  const { toast } = useToast();

  async function save() {
    const validOptions = options.filter((o) => o.name.trim());
    if (!name.trim() || validOptions.length === 0) return toast({ variant: "destructive", title: "Name and at least one option are required" });
    const payload = { name: name.trim(), selection_type: selectionType, max_select: maxSelect ? Number(maxSelect) : null, options: validOptions };
    const res = isNew
      ? await fetch("/api/modifier-groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch(`/api/modifier-groups/${group.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) return toast({ variant: "destructive", title: "Couldn't save group", description: data.error });
    toast({ variant: "success", title: isNew ? "Modifier group created" : "Modifier group saved", description: name.trim() });
    onSaved(); onClose();
  }

  async function remove() {
    if (isNew) return;
    const res = await fetch(`/api/modifier-groups/${group.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      return toast({ variant: "destructive", title: "Couldn't delete group", description: data.error });
    }
    toast({ variant: "success", title: "Modifier group deleted", description: group.name });
    onSaved(); onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto p-5">
        <h2 style={{ fontFamily: "var(--font-space-grotesk)" }} className="text-foreground font-bold text-lg">{isNew ? "New Modifier Group" : group.name}</h2>
        <div className="mt-4 space-y-2">
          <input placeholder="Group name (e.g. Spice Level)" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <select value={selectionType} onChange={(e) => setSelectionType(e.target.value as "single" | "multiple")} className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm">
              <option value="single">Single choice</option>
              <option value="multiple">Multiple choice</option>
            </select>
            {selectionType === "multiple" && (
              <input type="number" placeholder="Max selections" value={maxSelect} onChange={(e) => setMaxSelect(e.target.value)} className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
            )}
          </div>
          <div className="space-y-1.5">
            {options.map((o, i) => (
              <div key={i} className="grid grid-cols-[1fr_90px] gap-2">
                <input placeholder="Option name" value={o.name} onChange={(e) => setOptions((prev) => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} className="bg-surface-hover border border-border rounded-lg px-2 py-1.5 text-foreground text-sm" />
                <input type="number" step="0.01" placeholder="£ delta" value={o.price_delta} onChange={(e) => setOptions((prev) => prev.map((x, idx) => idx === i ? { ...x, price_delta: Number(e.target.value) } : x))} className="bg-surface-hover border border-border rounded-lg px-2 py-1.5 text-foreground text-sm" />
              </div>
            ))}
            <button onClick={() => setOptions((prev) => [...prev, { name: "", price_delta: 0 }])} className="text-red-600 text-xs font-semibold">+ Add option</button>
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button onClick={onClose} className="flex-1 h-10 bg-elevated hover:bg-elevated-hover text-foreground font-semibold rounded-xl">Cancel</button>
          {!isNew && <button onClick={remove} className="flex-1 h-10 bg-red-100 hover:bg-red-200 text-red-700 font-semibold rounded-xl text-sm">Delete</button>}
          <button onClick={save} className="flex-1 h-10 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl">Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Category grid card — the landing view's per-category tile, with inline
// rename/hide/delete/reorder so there's no separate "Categories" tab. ───────
function CategoryCard({
  cat, index, isFirst, isLast, busy, onOpen, onMove, onRename, onToggleActive, onDelete,
}: {
  cat: Category; index: number; isFirst: boolean; isLast: boolean; busy: boolean;
  onOpen: () => void; onMove: (dir: -1 | 1) => void; onRename: (name: string) => void;
  onToggleActive: () => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(cat.name);

  return (
    <div className={`rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgba(32,27,24,0.04),0_8px_24px_rgba(32,27,24,0.05)] p-4 ${!cat.active ? "opacity-50" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        {editing ? (
          <input
            autoFocus value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { onRename(editName); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
            className="flex-1 min-w-0 bg-surface-hover border border-border rounded-lg px-2 py-1 text-foreground text-sm font-semibold"
          />
        ) : (
          <button onClick={onOpen} className="flex-1 min-w-0 text-left">
            <h3 style={{ fontFamily: "var(--font-space-grotesk)" }} className="text-foreground text-[15px] font-semibold truncate">{cat.name}</h3>
            <p className="text-muted-foreground text-xs mt-0.5">{cat.item_count} item{cat.item_count === 1 ? "" : "s"}{!cat.active && " · hidden"}</p>
          </button>
        )}
        <div className="flex flex-col flex-shrink-0">
          <button onClick={() => onMove(-1)} disabled={busy || isFirst} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs leading-none">▲</button>
          <button onClick={() => onMove(1)} disabled={busy || isLast} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs leading-none">▼</button>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3 flex-wrap">
        {editing ? (
          <>
            <button onClick={() => { onRename(editName); setEditing(false); }} className="text-xs font-semibold text-red-600">Save</button>
            <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground">Cancel</button>
          </>
        ) : (
          <>
            <button onClick={() => { setEditName(cat.name); setEditing(true); }} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Rename</button>
            <button onClick={onToggleActive} disabled={busy} className="text-xs font-semibold text-muted-foreground hover:text-foreground">{cat.active ? "Hide" : "Show"}</button>
            <button
              onClick={onDelete}
              disabled={busy || cat.item_count > 0}
              title={cat.item_count > 0 ? "Move or delete its items first" : "Delete category"}
              className="text-xs font-semibold text-red-600 disabled:text-muted-foreground disabled:opacity-40"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Modifier Groups panel — a slide-over so it doesn't need a top-level tab ──
function ModifierGroupsPanel({ groups, onClose, onOpenGroup, onNewGroup }: {
  groups: ModifierGroup[]; onClose: () => void; onOpenGroup: (g: ModifierGroup) => void; onNewGroup: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 style={{ fontFamily: "var(--font-space-grotesk)" }} className="text-foreground font-bold text-lg">Modifier Groups</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
        </div>
        <div className="mt-3 flex justify-end">
          <button onClick={onNewGroup} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg">+ New Group</button>
        </div>
        <div className="mt-3 space-y-2">
          {groups.map((g) => (
            <button key={g.id} onClick={() => onOpenGroup(g)} className="w-full text-left rounded-lg border border-border bg-surface-hover px-4 py-3 hover:border-red-300">
              <p className="text-foreground font-semibold">{g.name} <span className="text-muted-foreground text-xs capitalize">({g.selection_type})</span></p>
              <p className="text-muted-foreground text-sm mt-1">{g.options.map((o) => `${o.name}${o.price_delta ? ` (+${fmtMoney(o.price_delta)})` : ""}`).join(", ")}</p>
            </button>
          ))}
          {groups.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">No modifier groups yet.</p>}
        </div>
      </div>
    </div>
  );
}

export default function MenuManagementView() {
  const [items, setItems] = useState<Item[]>([]);
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [modal, setModal] = useState<Item | "new" | null>(null);
  const [groupModal, setGroupModal] = useState<ModifierGroup | "new" | null>(null);
  const [showModifiers, setShowModifiers] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [newCatName, setNewCatName] = useState("");
  const [catBusy, setCatBusy] = useState(false);
  const [catError, setCatError] = useState("");

  const loadItems = useCallback(async () => {
    const res = await fetch("/api/menu-items");
    const data = await res.json();
    setItems(data.items || []);
  }, []);
  const loadGroups = useCallback(async () => {
    const res = await fetch("/api/modifier-groups");
    const data = await res.json();
    setGroups(data.groups || []);
  }, []);
  const loadCategories = useCallback(async () => {
    const res = await fetch("/api/menu-categories");
    const data = await res.json();
    setCategories(data.categories || []);
  }, []);
  useEffect(() => { loadItems(); loadGroups(); loadCategories(); }, [loadItems, loadGroups, loadCategories]);

  async function catCall(url: string, method: string, body?: unknown) {
    setCatBusy(true); setCatError("");
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const data = await res.json();
      if (!res.ok) { setCatError(data.error || "Something went wrong"); return false; }
      await Promise.all([loadCategories(), loadItems()]);
      return true;
    } finally {
      setCatBusy(false);
    }
  }

  async function quickAddCategory() {
    if (!newCatName.trim()) return;
    if (await catCall("/api/menu-categories", "POST", { name: newCatName.trim() })) setNewCatName("");
  }

  // Real category list (includes categories with no items yet); fall back to
  // the set referenced by items until the categories request lands.
  const categoryOptions = categories.length > 0
    ? [...categories].sort((a, b) => a.display_order - b.display_order).map((c) => ({ id: c.id, name: c.name }))
    : Array.from(new Map(items.map((i) => [i.category_id, i.category_name])).entries()).map(([id, name]) => ({ id, name }));
  const sortedCategories = [...categories].sort((a, b) => a.display_order - b.display_order || a.id - b.id);
  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
  const selectedCategory = sortedCategories.find((c) => c.id === selectedCategoryId) ?? null;
  const categoryItems = selectedCategoryId != null ? filtered.filter((i) => i.category_id === selectedCategoryId) : [];

  const itemRow = (i: Item) => (
    <button key={i.id} onClick={() => setModal(i)} className={`w-full text-left rounded-lg border border-border bg-surface shadow-[0_1px_2px_rgba(32,27,24,0.04),0_8px_24px_rgba(32,27,24,0.05)] px-4 py-2.5 flex items-center justify-between gap-3 hover:border-border ${!i.active ? "opacity-50" : ""}`}>
      <div>
        <span className="text-foreground font-medium">{i.name}</span>
        {i.active && i.online_available === 0 && <span className="ml-2 text-xs font-semibold text-muted-foreground">Till only</span>}
        {i.active && i.pos_available === 0 && <span className="ml-2 text-xs font-semibold text-muted-foreground">Website only</span>}
        {i.allergens.length > 0 && <span className="ml-2 text-amber-600 text-xs">⚠ {i.allergens.join(", ")}</span>}
        {!i.active && <span className="ml-2 text-muted-foreground text-xs">(inactive)</span>}
      </div>
      <span className="text-foreground whitespace-nowrap text-sm">
        {fmtMoney(i.price)}
        <span className="text-muted-foreground"> · web {i.online_price != null ? fmtMoney(i.online_price) : fmtMoney(i.price)}</span>
      </span>
    </button>
  );

  return (
    <>
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur px-4 py-4">
        <div className="mx-auto max-w-4xl flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 style={{ fontFamily: "var(--font-space-grotesk)" }} className="text-foreground text-[22px] font-semibold tracking-[-0.02em]">Menu Management</h1>
            <p className="text-muted-foreground text-sm">Menu items, categories, pricing and channel availability.</p>
          </div>
          <button onClick={() => setShowModifiers(true)} className="px-4 py-2 bg-surface-hover hover:bg-elevated text-foreground text-sm font-semibold rounded-lg border border-border whitespace-nowrap">
            ⚙ Modifier Groups
          </button>
        </div>
      </div>

      <div className="px-4 py-6">
      <div className="mx-auto max-w-4xl">
        {!selectedCategory ? (
          // ── Landing view: categories as a two-column grid ──────────────
          <div className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {sortedCategories.map((c, i) => (
                <CategoryCard
                  key={c.id} cat={c} index={i} isFirst={i === 0} isLast={i === sortedCategories.length - 1} busy={catBusy}
                  onOpen={() => { setSelectedCategoryId(c.id); setSearch(""); }}
                  onMove={(dir) => {
                    const swap = sortedCategories[i + dir];
                    if (!swap) return;
                    catCall(`/api/menu-categories/${c.id}`, "PATCH", { display_order: swap.display_order });
                    catCall(`/api/menu-categories/${swap.id}`, "PATCH", { display_order: c.display_order });
                  }}
                  onRename={(name) => name.trim() && catCall(`/api/menu-categories/${c.id}`, "PATCH", { name: name.trim() })}
                  onToggleActive={() => catCall(`/api/menu-categories/${c.id}`, "PATCH", { active: c.active ? 0 : 1 })}
                  onDelete={() => { if (confirm(`Delete "${c.name}"?`)) catCall(`/api/menu-categories/${c.id}`, "DELETE"); }}
                />
              ))}

              {/* + Add Category card */}
              <div className="rounded-xl border border-dashed border-border bg-surface-hover p-4 flex flex-col justify-center gap-2">
                <input
                  placeholder="New category name…" value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && quickAddCategory()}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                />
                <button onClick={quickAddCategory} disabled={catBusy || !newCatName.trim()} className="w-full py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg">+ Add Category</button>
              </div>
            </div>
            {catError && <p className="mt-3 text-red-600 text-sm">{catError}</p>}
            {sortedCategories.length === 0 && <p className="mt-6 text-muted-foreground text-sm text-center py-8">No categories yet — add one above.</p>}
          </div>
        ) : (
          // ── Category detail: its items, scoped search, add item ────────
          <div className="mt-4">
            <button onClick={() => setSelectedCategoryId(null)} className="text-muted-foreground hover:text-foreground text-sm font-semibold">← All Categories</button>
            <div className="mt-3 flex items-center justify-between flex-wrap gap-3">
              <h2 style={{ fontFamily: "var(--font-space-grotesk)" }} className="text-foreground text-lg font-semibold">{selectedCategory.name}</h2>
            </div>
            <div className="mt-3 flex gap-2">
              <input placeholder={`Search in ${selectedCategory.name}…`} value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
              <button onClick={() => setModal("new")} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg whitespace-nowrap">+ Add Item</button>
            </div>
            <div className="mt-5 space-y-1">
              {categoryItems.map(itemRow)}
              {categoryItems.length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-8">
                  {search ? `No items matching "${search}" in this category.` : "No items in this category yet."}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {modal && <ItemModal item={modal} categoryOptions={categoryOptions} allGroups={groups} defaultCategoryId={selectedCategoryId ?? undefined} onClose={() => setModal(null)} onSaved={() => { loadItems(); loadCategories(); }} />}
      {showModifiers && (
        <ModifierGroupsPanel groups={groups} onClose={() => setShowModifiers(false)} onOpenGroup={(g) => setGroupModal(g)} onNewGroup={() => setGroupModal("new")} />
      )}
      {groupModal && <GroupModal group={groupModal} onClose={() => setGroupModal(null)} onSaved={loadGroups} />}
      </div>
    </>
  );
}
