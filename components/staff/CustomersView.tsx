"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Customer = {
  id: number; name: string; phone: string; email: string | null; date_of_birth: string | null;
  loyalty_points: number; referral_code: string | null; lifetime_spend: number; visit_count: number; tier: string;
};
type Reward = { id: number; name: string; description: string | null; points_cost: number };
type Birthday = { id: number; name: string; phone: string; days_away: number };

function fmtMoney(n: number) { return `£${Number(n).toFixed(2)}`; }
const tierColor: Record<string, string> = { Gold: "text-amber-600", Silver: "text-foreground", Bronze: "text-red-700" };

function AddCustomerModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [referredBy, setReferredBy] = useState("");
  const [error, setError] = useState("");

  async function save() {
    if (!name.trim() || !phone.trim()) return setError("Name and phone are required.");
    const res = await fetch("/api/customers", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, email: email || undefined, date_of_birth: dob || undefined, referred_by_code: referredBy || undefined }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    onSaved(); onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto p-5">
        <h2 className="text-foreground font-bold text-lg">New Customer</h2>
        <div className="mt-4 space-y-2">
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
          <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
          <input placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
          <div>
            <label className="text-muted-foreground text-xs">Date of birth (for birthday offers)</label>
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
          </div>
          <input placeholder="Referral code (optional)" value={referredBy} onChange={(e) => setReferredBy(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
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

function CustomerDetailModal({ customerId, rewards, isManager, onClose, onChange }: {
  customerId: number; rewards: Reward[]; isManager: boolean; onClose: () => void; onChange: () => void;
}) {
  type Detail = {
    customer: Customer & { favourite_dish: string | null };
    orders: { id: number; order_number: string; order_type: string; status: string; total: number; created_at: string }[];
    transactions: { id: number; points_delta: number; reason: string; created_at: string }[];
  };
  const [detail, setDetail] = useState<Detail | null>(null);
  const [adjustPoints, setAdjustPoints] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/customers/${customerId}`);
    const data = await res.json();
    setDetail(data);
  }, [customerId]);
  useEffect(() => { load(); }, [load]);

  async function redeem(rewardId: number) {
    setError("");
    const res = await fetch("/api/loyalty/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer_id: customerId, reward_id: rewardId }) });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    load(); onChange();
  }

  async function adjust() {
    if (!adjustPoints) return;
    await fetch("/api/loyalty/adjust", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer_id: customerId, points_delta: Number(adjustPoints) }) });
    setAdjustPoints("");
    load(); onChange();
  }

  if (!detail) return null;
  const c = detail.customer;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-foreground font-bold text-lg">{c.name}</h2>
            <p className="text-muted-foreground text-sm">{c.phone} {c.email && `· ${c.email}`}</p>
          </div>
          <span className={`text-sm font-bold ${tierColor[c.tier]}`}>{c.tier}</span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-surface-hover p-2"><p className="text-foreground font-bold">{fmtMoney(c.lifetime_spend)}</p><p className="text-muted-foreground text-xs">Lifetime Spend</p></div>
          <div className="rounded-lg bg-surface-hover p-2"><p className="text-foreground font-bold">{c.visit_count}</p><p className="text-muted-foreground text-xs">Visits</p></div>
          <div className="rounded-lg bg-surface-hover p-2"><p className="text-foreground font-bold">{c.loyalty_points}</p><p className="text-muted-foreground text-xs">Points</p></div>
        </div>
        {c.favourite_dish && <p className="mt-2 text-sm text-muted-foreground">⭐ Favourite: {c.favourite_dish}</p>}
        {c.referral_code && <p className="mt-1 text-xs text-muted-foreground">Referral code: <span className="text-red-600">{c.referral_code}</span></p>}

        <div className="mt-4">
          <h3 className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Redeem a Reward</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {rewards.map((r) => (
              <button key={r.id} onClick={() => redeem(r.id)} disabled={c.loyalty_points < r.points_cost}
                className="px-3 py-1.5 bg-surface-hover hover:bg-elevated disabled:opacity-40 text-foreground text-xs font-semibold rounded-lg border border-border">
                {r.name} · {r.points_cost}pts
              </button>
            ))}
          </div>
          {error && <p className="mt-2 text-red-600 text-sm">{error}</p>}
        </div>

        {isManager && (
          <div className="mt-4 flex gap-2">
            <input type="number" placeholder="+/- points" value={adjustPoints} onChange={(e) => setAdjustPoints(e.target.value)} className="flex-1 bg-surface-hover border border-border rounded-lg px-3 py-1.5 text-foreground text-sm" />
            <button onClick={adjust} className="px-3 py-1.5 bg-elevated hover:bg-elevated-hover text-foreground text-xs font-bold rounded-lg">Adjust</button>
          </div>
        )}

        <div className="mt-4">
          <h3 className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Order History</h3>
          <div className="mt-2 space-y-1">
            {detail.orders.map((o) => (
              <div key={o.id} className="flex justify-between text-sm"><span className="text-foreground">{o.order_number} · {o.order_type}</span><span className="text-muted-foreground">{fmtMoney(o.total)}</span></div>
            ))}
            {detail.orders.length === 0 && <p className="text-muted-foreground text-sm">No orders yet.</p>}
          </div>
        </div>

        <button onClick={onClose} className="mt-5 w-full h-10 bg-elevated hover:bg-elevated-hover text-foreground font-semibold rounded-xl">Close</button>
      </div>
    </div>
  );
}

export default function CustomersView({ isManager }: { isManager: boolean }) {
  const [tab, setTab] = useState<"customers" | "rewards">("customers");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [modal, setModal] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [newReward, setNewReward] = useState({ name: "", points_cost: "" });

  const loadCustomers = useCallback(async () => {
    const res = await fetch(`/api/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`);
    const data = await res.json();
    setCustomers(data.customers || []);
  }, [search]);
  const loadRewards = useCallback(async () => {
    const res = await fetch("/api/loyalty/rewards");
    const data = await res.json();
    setRewards(data.rewards || []);
  }, []);
  const loadBirthdays = useCallback(async () => {
    const res = await fetch("/api/customers/birthdays");
    const data = await res.json();
    setBirthdays(data.upcomingBirthdays || []);
  }, []);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);
  useEffect(() => { loadRewards(); loadBirthdays(); }, [loadRewards, loadBirthdays]);

  async function addReward() {
    if (!newReward.name || !newReward.points_cost) return;
    await fetch("/api/loyalty/rewards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newReward.name, points_cost: Number(newReward.points_cost) }) });
    setNewReward({ name: "", points_cost: "" });
    loadRewards();
  }

  return (
    <>
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur px-4 py-4">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h1 className="text-foreground font-bold text-2xl">Customers & Loyalty</h1>
            <div className="flex items-center gap-2">
              <Link href="/staff" className="px-4 py-2 bg-surface-hover hover:bg-elevated text-foreground text-sm font-semibold rounded-lg border border-border">← Staff Hub</Link>
            </div>
          </div>

          <div className="flex flex-wrap gap-1 mt-4 bg-surface-hover p-1 rounded-xl">
            <button onClick={() => setTab("customers")} className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${tab === "customers" ? "bg-red-500 text-white" : "text-muted-foreground"}`}>Customers</button>
            <button onClick={() => setTab("rewards")} className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${tab === "rewards" ? "bg-red-500 text-white" : "text-muted-foreground"}`}>Rewards Catalog</button>
          </div>
        </div>
      </div>

      <div className="px-4 py-6">
      <div className="mx-auto max-w-4xl">
        {birthdays.length > 0 && (
          <div className="rounded-xl border border-amber-300/50 bg-amber-50 p-3 space-y-1">
            {birthdays.map((b) => (
              <p key={b.id} className="text-amber-700 text-sm">🎂 {b.name} — {b.days_away === 0 ? "today!" : `in ${b.days_away} day${b.days_away > 1 ? "s" : ""}`} ({b.phone})</p>
            ))}
          </div>
        )}

        {tab === "customers" && (
          <div className="mt-5">
            <div className="flex gap-2">
              <input placeholder="Search name or phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
              <button onClick={() => setModal(true)} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg">+ Add</button>
            </div>
            <div className="mt-3 rounded-xl border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface text-muted-foreground"><tr><th className="text-left px-3 py-2">Name</th><th className="text-left px-3 py-2">Phone</th><th className="text-right px-3 py-2">Spend</th><th className="text-right px-3 py-2">Visits</th><th className="text-right px-3 py-2">Points</th><th className="text-right px-3 py-2">Tier</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {customers.map((c) => (
                    <tr key={c.id} onClick={() => setDetailId(c.id)} className="bg-background hover:bg-surface cursor-pointer">
                      <td className="px-3 py-2 text-foreground font-medium">{c.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{c.phone}</td>
                      <td className="px-3 py-2 text-right text-foreground">{fmtMoney(c.lifetime_spend)}</td>
                      <td className="px-3 py-2 text-right text-foreground">{c.visit_count}</td>
                      <td className="px-3 py-2 text-right text-foreground">{c.loyalty_points}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${tierColor[c.tier]}`}>{c.tier}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {customers.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">No customers yet — they'll appear automatically once orders/reservations come in with a phone number.</p>}
            </div>
          </div>
        )}

        {tab === "rewards" && (
          <div className="mt-5">
            {isManager && (
              <div className="flex gap-2">
                <input placeholder="Reward name" value={newReward.name} onChange={(e) => setNewReward({ ...newReward, name: e.target.value })} className="flex-1 bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
                <input type="number" placeholder="Points cost" value={newReward.points_cost} onChange={(e) => setNewReward({ ...newReward, points_cost: e.target.value })} className="w-32 bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
                <button onClick={addReward} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg">+ Add</button>
              </div>
            )}
            <div className="mt-3 space-y-2">
              {rewards.map((r) => (
                <div key={r.id} className="rounded-lg border border-border bg-surface px-4 py-3">
                  <p className="text-foreground font-semibold">{r.name} <span className="text-red-600">· {r.points_cost} pts</span></p>
                  {r.description && <p className="text-muted-foreground text-sm">{r.description}</p>}
                </div>
              ))}
              {rewards.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">No rewards in the catalog yet.</p>}
            </div>
          </div>
        )}
      </div>

      {modal && <AddCustomerModal onClose={() => setModal(false)} onSaved={loadCustomers} />}
      {detailId && <CustomerDetailModal customerId={detailId} rewards={rewards} isManager={isManager} onClose={() => setDetailId(null)} onChange={loadCustomers} />}
      </div>
    </>
  );
}
