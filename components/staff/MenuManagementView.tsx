"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ALLERGENS } from "@/lib/allergens";

type Item = {
  id: number; category_id: number; category_name: string; name: string; description: string | null;
  price: number; online_price: number | null; is_veg: number; active: number; allergens: string[];
  pos_available: number; online_available: number;
  calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null;
};
type ModifierOption = { id?: number; name: string; price_delta: number };
type ModifierGroup = { id: number; name: string; selection_type: "single" | "multiple"; min_select: number; max_select: number | null; options: ModifierOption[] };

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

function ItemModal({ item, categoryOptions, allGroups, onClose, onSaved }: {
  item: Item | "new"; categoryOptions: { id: number; name: string }[]; allGroups: ModifierGroup[]; onClose: () => void; onSaved: () => void;
}) {
  const isNew = item === "new";
  const [form, setForm] = useState({
    category_id: isNew ? categoryOptions[0]?.id ?? 0 : item.category_id,
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
  const [error, setError] = useState("");
  const [savedItemId, setSavedItemId] = useState<number | null>(isNew ? null : item.id);

  function toggleAllergen(a: string) {
    setForm((f) => ({ ...f, allergens: f.allergens.includes(a) ? f.allergens.filter((x) => x !== a) : [...f.allergens, a] }));
  }

  async function save() {
    if (!form.name.trim() || !form.price) return setError("Name and till price are required.");
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
    if (!res.ok) return setError(data.error);
    onSaved();
    if (isNew) setSavedItemId(data.item.id);
    else onClose();
  }

  async function toggleActive() {
    if (isNew || !savedItemId) return;
    await fetch(`/api/menu-items/${savedItemId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: (item as Item).active ? 0 : 1 }) });
    onSaved(); onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5">
        <h2 className="text-foreground font-bold text-lg">{isNew ? "New Menu Item" : item.name}</h2>
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

        {error && <p className="mt-2 text-red-600 text-sm">{error}</p>}
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
  const [error, setError] = useState("");

  async function save() {
    const validOptions = options.filter((o) => o.name.trim());
    if (!name.trim() || validOptions.length === 0) return setError("Name and at least one option are required.");
    const payload = { name: name.trim(), selection_type: selectionType, max_select: maxSelect ? Number(maxSelect) : null, options: validOptions };
    const res = isNew
      ? await fetch("/api/modifier-groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch(`/api/modifier-groups/${group.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    onSaved(); onClose();
  }

  async function remove() {
    if (isNew) return;
    await fetch(`/api/modifier-groups/${group.id}`, { method: "DELETE" });
    onSaved(); onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto p-5">
        <h2 className="text-foreground font-bold text-lg">{isNew ? "New Modifier Group" : group.name}</h2>
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
        {error && <p className="mt-2 text-red-600 text-sm">{error}</p>}
        <div className="mt-4 flex gap-3">
          <button onClick={onClose} className="flex-1 h-10 bg-elevated hover:bg-elevated-hover text-foreground font-semibold rounded-xl">Cancel</button>
          {!isNew && <button onClick={remove} className="flex-1 h-10 bg-red-100 hover:bg-red-200 text-red-700 font-semibold rounded-xl text-sm">Delete</button>}
          <button onClick={save} className="flex-1 h-10 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl">Save</button>
        </div>
      </div>
    </div>
  );
}

export default function MenuManagementView() {
  const [tab, setTab] = useState<"items" | "modifiers">("items");
  const [items, setItems] = useState<Item[]>([]);
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [modal, setModal] = useState<Item | "new" | null>(null);
  const [groupModal, setGroupModal] = useState<ModifierGroup | "new" | null>(null);
  const [search, setSearch] = useState("");

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
  useEffect(() => { loadItems(); loadGroups(); }, [loadItems, loadGroups]);

  const categoryOptions = Array.from(new Map(items.map((i) => [i.category_id, i.category_name])).entries()).map(([id, name]) => ({ id, name }));
  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
  const grouped = new Map<string, Item[]>();
  for (const i of filtered) grouped.set(i.category_name, [...(grouped.get(i.category_name) || []), i]);

  return (
    <>
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur px-4 py-4">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h1 className="text-foreground font-bold text-2xl">Menu Management</h1>
            <div className="flex items-center gap-2">
              <Link href="/staff" className="px-4 py-2 bg-surface-hover hover:bg-elevated text-foreground text-sm font-semibold rounded-lg border border-border">← Staff Hub</Link>
            </div>
          </div>

          <div className="flex flex-wrap gap-1 mt-4 bg-surface-hover p-1 rounded-xl">
            <button onClick={() => setTab("items")} className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${tab === "items" ? "bg-red-500 text-white" : "text-muted-foreground"}`}>Items</button>
            <button onClick={() => setTab("modifiers")} className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${tab === "modifiers" ? "bg-red-500 text-white" : "text-muted-foreground"}`}>Modifier Groups</button>
          </div>
        </div>
      </div>

      <div className="px-4 py-6">
      <div className="mx-auto max-w-4xl">
        {tab === "items" && (
          <>
            <div className="mt-4 flex gap-2">
              <input placeholder="Search items…" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
              <button onClick={() => setModal("new")} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg">+ New Item</button>
            </div>

            <div className="mt-5 space-y-6">
              {Array.from(grouped.entries()).map(([catName, catItems]) => (
                <div key={catName}>
                  <h2 className="text-red-600 font-bold text-sm uppercase tracking-widest mb-2">{catName}</h2>
                  <div className="space-y-1">
                    {catItems.map((i) => (
                      <button key={i.id} onClick={() => setModal(i)} className={`w-full text-left rounded-lg border border-border bg-surface px-4 py-2.5 flex items-center justify-between gap-3 hover:border-border ${!i.active ? "opacity-50" : ""}`}>
                        <div>
                          <span className="text-foreground font-medium">{i.name}</span>
                          {i.active && i.online_available === 0 && <span className="ml-2 text-xs font-semibold text-blue-600">Till only</span>}
                          {i.active && i.pos_available === 0 && <span className="ml-2 text-xs font-semibold text-purple-600">Website only</span>}
                          {i.allergens.length > 0 && <span className="ml-2 text-amber-600 text-xs">⚠ {i.allergens.join(", ")}</span>}
                          {!i.active && <span className="ml-2 text-muted-foreground text-xs">(inactive)</span>}
                        </div>
                        <span className="text-foreground whitespace-nowrap text-sm">
                          {fmtMoney(i.price)}
                          <span className="text-muted-foreground"> · web {i.online_price != null ? fmtMoney(i.online_price) : fmtMoney(i.price)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {items.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">No menu items yet.</p>}
            </div>
          </>
        )}

        {tab === "modifiers" && (
          <div className="mt-4">
            <div className="flex justify-end"><button onClick={() => setGroupModal("new")} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg">+ New Group</button></div>
            <div className="mt-3 space-y-2">
              {groups.map((g) => (
                <button key={g.id} onClick={() => setGroupModal(g)} className="w-full text-left rounded-lg border border-border bg-surface px-4 py-3 hover:border-border">
                  <p className="text-foreground font-semibold">{g.name} <span className="text-muted-foreground text-xs capitalize">({g.selection_type})</span></p>
                  <p className="text-muted-foreground text-sm mt-1">{g.options.map((o) => `${o.name}${o.price_delta ? ` (+${fmtMoney(o.price_delta)})` : ""}`).join(", ")}</p>
                </button>
              ))}
              {groups.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">No modifier groups yet.</p>}
            </div>
          </div>
        )}
      </div>

      {modal && <ItemModal item={modal} categoryOptions={categoryOptions} allGroups={groups} onClose={() => setModal(null)} onSaved={loadItems} />}
      {groupModal && <GroupModal group={groupModal} onClose={() => setGroupModal(null)} onSaved={loadGroups} />}
      </div>
    </>
  );
}
