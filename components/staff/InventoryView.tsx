"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Ingredient = {
  id: number; name: string; unit: string; current_stock: number; reorder_level: number;
  reorder_quantity: number; cost_per_unit: number; supplier_id: number | null; supplier_name: string | null;
};
type Supplier = { id: number; name: string; contact_name: string | null; phone: string | null; email: string | null; active: number };
type PO = { id: number; order_number: string; supplier_id: number; supplier_name: string; status: string; order_date: string; expected_date: string | null; total_cost: number };
type Recipe = { id: number; menu_item_id: number | null; menu_item_name: string | null; menu_item_price: number | null; name: string; yield_quantity: number; yield_unit: string; recipe_cost: number; food_cost_pct: number | null };

function fmtMoney(n: number) { return `£${Number(n).toFixed(2)}`; }

// ── Ingredients ──────────────────────────────────────────────────────────────
function IngredientModal({ suppliers, onClose, onSaved }: { suppliers: Supplier[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("kg");
  const [reorderLevel, setReorderLevel] = useState("0");
  const [reorderQty, setReorderQty] = useState("0");
  const [costPerUnit, setCostPerUnit] = useState("0");
  const [supplierId, setSupplierId] = useState("");
  const [openingStock, setOpeningStock] = useState("0");
  const [error, setError] = useState("");

  async function save() {
    if (!name.trim()) return setError("Name is required.");
    const res = await fetch("/api/ingredients", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(), unit, reorder_level: Number(reorderLevel), reorder_quantity: Number(reorderQty),
        cost_per_unit: Number(costPerUnit), supplier_id: supplierId ? Number(supplierId) : null, opening_stock: Number(openingStock),
      }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    onSaved(); onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto p-5">
        <h2 className="text-foreground font-bold text-lg">New Ingredient</h2>
        <div className="mt-4 space-y-2">
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm">
              <option value="kg">kg</option><option value="g">g</option><option value="l">l</option><option value="ml">ml</option><option value="each">each</option>
            </select>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm">
              <option value="">No supplier</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div><label className="text-muted-foreground">Opening stock</label><input type="number" value={openingStock} onChange={(e) => setOpeningStock(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-2 py-1.5 text-foreground" /></div>
            <div><label className="text-muted-foreground">Reorder at</label><input type="number" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-2 py-1.5 text-foreground" /></div>
            <div><label className="text-muted-foreground">Reorder qty</label><input type="number" value={reorderQty} onChange={(e) => setReorderQty(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-2 py-1.5 text-foreground" /></div>
          </div>
          <div><label className="text-muted-foreground text-xs">Cost per unit (£)</label><input type="number" step="0.01" value={costPerUnit} onChange={(e) => setCostPerUnit(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-2 py-1.5 text-foreground text-sm" /></div>
        </div>
        {error && <p className="mt-2 text-red-600 text-sm">{error}</p>}
        <div className="mt-4 flex gap-3">
          <button onClick={onClose} className="flex-1 h-10 bg-elevated hover:bg-elevated-hover text-foreground font-semibold rounded-xl">Cancel</button>
          <button onClick={save} className="flex-1 h-10 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl">Save</button>
        </div>
      </div>
    </div>
  );
}

function StockMovementModal({ ingredient, onClose, onSaved }: { ingredient: Ingredient; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<"waste" | "adjustment" | "usage">("waste");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  async function save() {
    if (!quantity || Number(quantity) === 0) return setError("Enter a quantity.");
    const res = await fetch("/api/stock-movements", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingredient_id: ingredient.id, movement_type: type, quantity: Number(quantity), reason: reason || undefined }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    onSaved(); onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto p-5">
        <h2 className="text-foreground font-bold text-lg">{ingredient.name}</h2>
        <p className="text-muted-foreground text-sm">Current stock: {ingredient.current_stock} {ingredient.unit}</p>
        <div className="mt-4 space-y-2">
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm">
            <option value="waste">Waste</option>
            <option value="usage">Usage (manual)</option>
            <option value="adjustment">Adjustment (+/-)</option>
          </select>
          <input type="number" step="0.001" placeholder={type === "adjustment" ? "Delta (e.g. -2 or 5)" : `Quantity (${ingredient.unit})`} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
          <input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
        </div>
        {error && <p className="mt-2 text-red-600 text-sm">{error}</p>}
        <div className="mt-4 flex gap-3">
          <button onClick={onClose} className="flex-1 h-10 bg-elevated hover:bg-elevated-hover text-foreground font-semibold rounded-xl">Cancel</button>
          <button onClick={save} className="flex-1 h-10 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl">Record</button>
        </div>
      </div>
    </div>
  );
}

function IngredientsTab({ suppliers }: { suppliers: Supplier[] }) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [modal, setModal] = useState(false);
  const [movementFor, setMovementFor] = useState<Ingredient | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/ingredients");
    const data = await res.json();
    setIngredients(data.ingredients || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex justify-end"><button onClick={() => setModal(true)} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg">+ Add Ingredient</button></div>
      <div className="mt-3 rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface text-muted-foreground"><tr><th className="text-left px-3 py-2">Name</th><th className="text-right px-3 py-2">Stock</th><th className="text-right px-3 py-2">Reorder At</th><th className="text-right px-3 py-2">Cost/Unit</th><th className="text-left px-3 py-2">Supplier</th><th /></tr></thead>
          <tbody className="divide-y divide-border">
            {ingredients.map((i) => {
              const low = Number(i.current_stock) <= Number(i.reorder_level);
              return (
                <tr key={i.id} className="bg-background">
                  <td className="px-3 py-2 text-foreground font-medium">{i.name}</td>
                  <td className={`px-3 py-2 text-right ${low ? "text-red-600 font-bold" : "text-foreground"}`}>{Number(i.current_stock).toFixed(2)} {i.unit} {low && "⚠"}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{i.reorder_level} {i.unit}</td>
                  <td className="px-3 py-2 text-right text-foreground">{fmtMoney(i.cost_per_unit)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{i.supplier_name || "—"}</td>
                  <td className="px-3 py-2 text-right"><button onClick={() => setMovementFor(i)} className="text-red-600 hover:text-red-700 text-xs font-semibold">Adjust</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {ingredients.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">No ingredients yet.</p>}
      </div>
      {modal && <IngredientModal suppliers={suppliers} onClose={() => setModal(false)} onSaved={load} />}
      {movementFor && <StockMovementModal ingredient={movementFor} onClose={() => setMovementFor(null)} onSaved={load} />}
    </div>
  );
}

// ── Suppliers ────────────────────────────────────────────────────────────────
function SuppliersTab({ suppliers, onChange }: { suppliers: Supplier[]; onChange: () => void }) {
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  async function save() {
    if (!name.trim()) return;
    await fetch("/api/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, contact_name: contact, phone, email }) });
    setModal(false); setName(""); setContact(""); setPhone(""); setEmail("");
    onChange();
  }

  return (
    <div>
      <div className="flex justify-end"><button onClick={() => setModal(true)} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg">+ Add Supplier</button></div>
      <div className="mt-3 space-y-2">
        {suppliers.map((s) => (
          <div key={s.id} className="rounded-lg border border-border bg-surface px-4 py-3">
            <p className="text-foreground font-semibold">{s.name}</p>
            <p className="text-muted-foreground text-sm">{[s.contact_name, s.phone, s.email].filter(Boolean).join(" · ") || "No contact details"}</p>
          </div>
        ))}
        {suppliers.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">No suppliers yet.</p>}
      </div>
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto p-5">
            <h2 className="text-foreground font-bold text-lg">New Supplier</h2>
            <div className="mt-4 space-y-2">
              <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
              <input placeholder="Contact name" value={contact} onChange={(e) => setContact(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
              <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
              <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
            </div>
            <div className="mt-4 flex gap-3">
              <button onClick={() => setModal(false)} className="flex-1 h-10 bg-elevated hover:bg-elevated-hover text-foreground font-semibold rounded-xl">Cancel</button>
              <button onClick={save} className="flex-1 h-10 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Purchase Orders ──────────────────────────────────────────────────────────
type POItem = { ingredient_id: number; quantity: number; unit_cost: number };

function NewPoModal({ suppliers, ingredients, onClose, onSaved }: { suppliers: Supplier[]; ingredients: Ingredient[]; onClose: () => void; onSaved: () => void }) {
  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState<POItem[]>([{ ingredient_id: 0, quantity: 1, unit_cost: 0 }]);
  const [error, setError] = useState("");

  function updateItem(i: number, field: keyof POItem, value: number) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));
  }

  async function save() {
    if (!supplierId) return setError("Pick a supplier.");
    const validItems = items.filter((i) => i.ingredient_id > 0 && i.quantity > 0);
    if (validItems.length === 0) return setError("Add at least one item.");
    const res = await fetch("/api/purchase-orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplier_id: Number(supplierId), items: validItems, status: "ordered" }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    onSaved(); onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5">
        <h2 className="text-foreground font-bold text-lg">New Purchase Order</h2>
        <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="mt-3 w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm">
          <option value="">Select supplier…</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <div className="mt-4 space-y-2">
          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-[1fr_70px_80px] gap-2">
              <select value={item.ingredient_id} onChange={(e) => updateItem(i, "ingredient_id", Number(e.target.value))} className="bg-surface-hover border border-border rounded-lg px-2 py-1.5 text-foreground text-sm">
                <option value={0}>Ingredient…</option>
                {ingredients.map((ing) => <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>)}
              </select>
              <input type="number" step="0.01" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(i, "quantity", Number(e.target.value))} className="bg-surface-hover border border-border rounded-lg px-2 py-1.5 text-foreground text-sm" />
              <input type="number" step="0.01" placeholder="£/unit" value={item.unit_cost} onChange={(e) => updateItem(i, "unit_cost", Number(e.target.value))} className="bg-surface-hover border border-border rounded-lg px-2 py-1.5 text-foreground text-sm" />
            </div>
          ))}
          <button onClick={() => setItems((prev) => [...prev, { ingredient_id: 0, quantity: 1, unit_cost: 0 }])} className="text-red-600 text-xs font-semibold">+ Add line</button>
        </div>

        {error && <p className="mt-2 text-red-600 text-sm">{error}</p>}
        <div className="mt-4 flex gap-3">
          <button onClick={onClose} className="flex-1 h-10 bg-elevated hover:bg-elevated-hover text-foreground font-semibold rounded-xl">Cancel</button>
          <button onClick={save} className="flex-1 h-10 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl">Create Order</button>
        </div>
      </div>
    </div>
  );
}

function ReceivePoModal({ poId, onClose, onSaved }: { poId: number; onClose: () => void; onSaved: () => void }) {
  const [items, setItems] = useState<{ id: number; ingredient_name: string; unit: string; quantity: number; received_quantity: number; expiry_date: string }[]>([]);
  const [orderNumber, setOrderNumber] = useState("");

  useEffect(() => {
    fetch(`/api/purchase-orders/${poId}`).then((r) => r.json()).then((d) => {
      setOrderNumber(d.purchaseOrder.order_number);
      setItems((d.items || []).map((i: { id: number; ingredient_name: string; unit: string; quantity: number }) => ({ ...i, received_quantity: i.quantity, expiry_date: "" })));
    });
  }, [poId]);

  async function confirm() {
    await fetch(`/api/purchase-orders/${poId}/receive`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: items.map((i) => ({ item_id: i.id, received_quantity: i.received_quantity, expiry_date: i.expiry_date || undefined })) }),
    });
    onSaved(); onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5">
        <h2 className="text-foreground font-bold text-lg">Receive {orderNumber}</h2>
        <div className="mt-4 space-y-2">
          {items.map((item, i) => (
            <div key={item.id} className="grid grid-cols-[1fr_90px_120px] gap-2 items-center">
              <span className="text-foreground text-sm">{item.ingredient_name}</span>
              <input type="number" step="0.01" value={item.received_quantity} onChange={(e) => setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, received_quantity: Number(e.target.value) } : it))} className="bg-surface-hover border border-border rounded-lg px-2 py-1.5 text-foreground text-sm" />
              <input type="date" value={item.expiry_date} onChange={(e) => setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, expiry_date: e.target.value } : it))} className="bg-surface-hover border border-border rounded-lg px-2 py-1.5 text-foreground text-sm" />
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-3">
          <button onClick={onClose} className="flex-1 h-10 bg-elevated hover:bg-elevated-hover text-foreground font-semibold rounded-xl">Cancel</button>
          <button onClick={confirm} className="flex-1 h-10 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl">Mark Received</button>
        </div>
      </div>
    </div>
  );
}

function PurchaseOrdersTab({ suppliers, ingredients }: { suppliers: Supplier[]; ingredients: Ingredient[] }) {
  const [pos, setPos] = useState<PO[]>([]);
  const [modal, setModal] = useState(false);
  const [receiving, setReceiving] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/purchase-orders");
    const data = await res.json();
    setPos(data.purchaseOrders || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex justify-end"><button onClick={() => setModal(true)} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg">+ New Purchase Order</button></div>
      <div className="mt-3 space-y-2">
        {pos.map((po) => (
          <div key={po.id} className="rounded-lg border border-border bg-surface px-4 py-3 flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-foreground font-semibold">{po.order_number} · {po.supplier_name}</p>
              <p className="text-muted-foreground text-sm">{po.order_date} · {fmtMoney(po.total_cost)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${po.status === "received" ? "bg-green-100 text-green-700" : po.status === "cancelled" ? "bg-surface-hover text-muted-foreground" : "bg-amber-100 text-amber-700"}`}>{po.status}</span>
              {po.status === "ordered" && <button onClick={() => setReceiving(po.id)} className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg">Receive</button>}
            </div>
          </div>
        ))}
        {pos.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">No purchase orders yet.</p>}
      </div>
      {modal && <NewPoModal suppliers={suppliers} ingredients={ingredients} onClose={() => setModal(false)} onSaved={load} />}
      {receiving && <ReceivePoModal poId={receiving} onClose={() => setReceiving(null)} onSaved={load} />}
    </div>
  );
}

// ── Recipes ──────────────────────────────────────────────────────────────────
function RecipesTab({ ingredients }: { ingredients: Ingredient[] }) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [lines, setLines] = useState<{ ingredient_id: number; quantity: number }[]>([{ ingredient_id: 0, quantity: 0 }]);

  const load = useCallback(async () => {
    const res = await fetch("/api/recipes");
    const data = await res.json();
    setRecipes(data.recipes || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!name.trim()) return;
    await fetch("/api/recipes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ingredients: lines.filter((l) => l.ingredient_id > 0) }),
    });
    setModal(false); setName(""); setLines([{ ingredient_id: 0, quantity: 0 }]);
    load();
  }

  return (
    <div>
      <div className="flex justify-end"><button onClick={() => setModal(true)} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg">+ New Recipe</button></div>
      <div className="mt-3 rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface text-muted-foreground"><tr><th className="text-left px-3 py-2">Recipe</th><th className="text-left px-3 py-2">Menu Item</th><th className="text-right px-3 py-2">Cost</th><th className="text-right px-3 py-2">Price</th><th className="text-right px-3 py-2">Food Cost %</th></tr></thead>
          <tbody className="divide-y divide-border">
            {recipes.map((r) => (
              <tr key={r.id} className="bg-background">
                <td className="px-3 py-2 text-foreground font-medium">{r.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.menu_item_name || "—"}</td>
                <td className="px-3 py-2 text-right text-foreground">{fmtMoney(r.recipe_cost)}</td>
                <td className="px-3 py-2 text-right text-foreground">{r.menu_item_price ? fmtMoney(r.menu_item_price) : "—"}</td>
                <td className={`px-3 py-2 text-right font-semibold ${r.food_cost_pct && r.food_cost_pct > 35 ? "text-red-600" : "text-emerald-600"}`}>{r.food_cost_pct ?? "—"}{r.food_cost_pct ? "%" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {recipes.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">No recipes yet.</p>}
      </div>
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto p-5">
            <h2 className="text-foreground font-bold text-lg">New Recipe</h2>
            <input placeholder="Recipe name" value={name} onChange={(e) => setName(e.target.value)} className="mt-3 w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
            <div className="mt-3 space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_80px] gap-2">
                  <select value={l.ingredient_id} onChange={(e) => setLines((prev) => prev.map((x, idx) => idx === i ? { ...x, ingredient_id: Number(e.target.value) } : x))} className="bg-surface-hover border border-border rounded-lg px-2 py-1.5 text-foreground text-sm">
                    <option value={0}>Ingredient…</option>
                    {ingredients.map((ing) => <option key={ing.id} value={ing.id}>{ing.name}</option>)}
                  </select>
                  <input type="number" step="0.001" placeholder="Qty" value={l.quantity} onChange={(e) => setLines((prev) => prev.map((x, idx) => idx === i ? { ...x, quantity: Number(e.target.value) } : x))} className="bg-surface-hover border border-border rounded-lg px-2 py-1.5 text-foreground text-sm" />
                </div>
              ))}
              <button onClick={() => setLines((prev) => [...prev, { ingredient_id: 0, quantity: 0 }])} className="text-red-600 text-xs font-semibold">+ Add ingredient</button>
            </div>
            <div className="mt-4 flex gap-3">
              <button onClick={() => setModal(false)} className="flex-1 h-10 bg-elevated hover:bg-elevated-hover text-foreground font-semibold rounded-xl">Cancel</button>
              <button onClick={save} className="flex-1 h-10 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function InventoryView() {
  const [tab, setTab] = useState<"ingredients" | "suppliers" | "orders" | "recipes">("ingredients");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [alerts, setAlerts] = useState<{ lowStock: Ingredient[]; expiringSoon: { ingredient_name: string; expiry_date: string }[] }>({ lowStock: [], expiringSoon: [] });

  const loadSuppliers = useCallback(async () => {
    const res = await fetch("/api/suppliers");
    const data = await res.json();
    setSuppliers(data.suppliers || []);
  }, []);
  const loadIngredients = useCallback(async () => {
    const res = await fetch("/api/ingredients");
    const data = await res.json();
    setIngredients(data.ingredients || []);
  }, []);
  const loadAlerts = useCallback(async () => {
    const res = await fetch("/api/inventory/alerts");
    const data = await res.json();
    setAlerts({ lowStock: data.lowStock || [], expiringSoon: data.expiringSoon || [] });
  }, []);

  useEffect(() => { loadSuppliers(); loadIngredients(); loadAlerts(); }, [loadSuppliers, loadIngredients, loadAlerts]);

  const tabs = [
    { id: "ingredients", label: "Ingredients" },
    { id: "suppliers", label: "Suppliers" },
    { id: "orders", label: "Purchase Orders" },
    { id: "recipes", label: "Recipes & Food Cost" },
  ] as const;

  return (
    <>
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur px-4 py-4">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h1 className="text-foreground font-bold text-2xl">Inventory</h1>
            <div className="flex items-center gap-2">
              <Link href="/staff" className="px-4 py-2 bg-surface-hover hover:bg-elevated text-foreground text-sm font-semibold rounded-lg border border-border">← Staff Hub</Link>
            </div>
          </div>

          <div className="flex flex-wrap gap-1 mt-4 bg-surface-hover p-1 rounded-xl">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap ${tab === t.id ? "bg-red-500 text-white" : "text-muted-foreground"}`}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-6">
      <div className="mx-auto max-w-5xl">
        {(alerts.lowStock.length > 0 || alerts.expiringSoon.length > 0) && (
          <div className="rounded-xl border border-amber-300/50 bg-amber-50 p-3 space-y-1">
            {alerts.lowStock.map((i) => <p key={i.id} className="text-amber-700 text-sm">⚠ Low stock: {i.name} ({i.current_stock} {i.unit} left)</p>)}
            {alerts.expiringSoon.map((i, idx) => <p key={idx} className="text-amber-700 text-sm">⏳ Expiring soon: {i.ingredient_name} on {i.expiry_date}</p>)}
          </div>
        )}

        <div className="mt-5">
          {tab === "ingredients" && <IngredientsTab suppliers={suppliers} />}
          {tab === "suppliers" && <SuppliersTab suppliers={suppliers} onChange={loadSuppliers} />}
          {tab === "orders" && <PurchaseOrdersTab suppliers={suppliers} ingredients={ingredients} />}
          {tab === "recipes" && <RecipesTab ingredients={ingredients} />}
        </div>
      </div>
      </div>
    </>
  );
}
