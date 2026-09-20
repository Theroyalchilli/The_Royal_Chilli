"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Reward = { id: number; name: string; description: string | null; points_cost: number; discount_amount: number | null };
type Redemption = {
  id: number;
  code: string;
  status: string;
  points_spent: number;
  issued_at: string;
  expires_at: string;
  reward: { name: string; discount_amount: number | null } | null;
};
type LoyaltyData = { points: number; rewards: Reward[]; activeRedemption: Redemption | null };

const R = 88;
const CIRCUMFERENCE = 2 * Math.PI * R;

function Donut({ points, nextReward }: { points: number; nextReward: Reward | null }) {
  const frac = nextReward ? Math.max(0.02, Math.min(1, points / nextReward.points_cost)) : 1;
  const offset = CIRCUMFERENCE * (1 - frac);
  return (
    <div className="flex flex-col items-center px-4 pt-6 pb-2">
      <div className="relative h-[200px] w-[200px]">
        <svg width="200" height="200" viewBox="0 0 200 200" className="-rotate-90">
          <circle cx="100" cy="100" r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth="16" />
          <circle
            cx="100" cy="100" r={R} fill="none" stroke="#D8A24A" strokeWidth="16" strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset .4s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="font-[family-name:var(--font-playfair)] text-4xl">{points}</div>
          <div className="mt-1 text-xs text-muted-foreground">total points</div>
        </div>
      </div>
      <div className="mt-2.5 text-center text-sm text-muted-foreground">
        {nextReward ? (
          <><b className="text-primary">{nextReward.points_cost - points}</b> points to {nextReward.name}</>
        ) : (
          "All rewards unlocked"
        )}
      </div>
    </div>
  );
}

function RewardRow({ reward, points, onRedeem, busy }: { reward: Reward; points: number; onRedeem: (id: number) => void; busy: boolean }) {
  const can = points >= reward.points_cost;
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-3.5 last:border-b-0">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-lg">💷</div>
        <div>
          <div className="font-semibold">{reward.name}</div>
          <div className="text-xs text-muted-foreground">{reward.points_cost} points</div>
        </div>
      </div>
      <button
        onClick={() => onRedeem(reward.id)}
        disabled={!can || busy}
        className={`rounded-lg px-4 py-2 text-xs font-bold ${can ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
      >
        {can ? "Redeem" : "Locked"}
      </button>
    </div>
  );
}

function VoucherPanel({ redemption, onCancel, busy }: { redemption: Redemption | null; onCancel: () => void; busy: boolean }) {
  if (!redemption) {
    return (
      <div className="px-4 py-10 text-center text-sm text-muted-foreground">
        <span className="mb-1.5 block text-2xl">🎟️</span>
        No active voucher.
        <br />
        Redeem points from Overview to create a voucher to use at the till.
      </div>
    );
  }
  const code = redemption.code;
  const disp = `${code.slice(0, 4)} ${code.slice(4)}`;
  const expires = new Date(redemption.expires_at);
  const expiresLabel = expires.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  return (
    <div className="px-4 py-5 text-center">
      <div className="text-xs text-muted-foreground">Give this voucher number at the till</div>
      <div className="mx-auto my-3 rounded-2xl bg-primary py-4 font-[family-name:var(--font-playfair)] text-3xl tracking-[6px] text-primary-foreground">
        {disp}
      </div>
      <div className="text-sm text-muted-foreground">
        {redemption.reward?.name}
        {redemption.reward?.discount_amount ? ` · £${Number(redemption.reward.discount_amount).toFixed(2)} off order` : ""}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{redemption.points_spent} points redeemed</div>
      <div className="mt-2 text-xs text-amber-600">Expires {expiresLabel}</div>
      <button
        onClick={onCancel}
        disabled={busy}
        className="mt-4 w-full rounded-xl border border-border bg-muted py-3 text-sm font-semibold hover:bg-muted/70"
      >
        Cancel voucher
      </button>
      <div className="mt-4 border-t border-dashed border-border pt-3 text-xs text-muted-foreground">
        A member of staff will confirm this number and apply your discount at the till.
      </div>
    </div>
  );
}

function LoyaltyInner() {
  const router = useRouter();
  const initialTab = useSearchParams().get("tab") === "voucher" ? "voucher" : "rewards";
  const [tab, setTab] = useState<"rewards" | "voucher" | "how">(initialTab);
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [confirmReward, setConfirmReward] = useState<Reward | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/account/loyalty");
    if (res.ok) setData(await res.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  async function redeem(rewardId: number) {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/account/loyalty/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reward_id: rewardId }),
      });
      const result = await res.json();
      if (!res.ok) {
        setMsg(result.error || "Something went wrong");
        return;
      }
      setConfirmReward(null);
      await load();
      setTab("voucher");
      router.refresh(); // re-render the layout's server-fetched points chip
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await fetch("/api/account/loyalty/cancel", { method: "POST" });
      await load();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;
  const nextReward = data.rewards.find((r) => r.points_cost > data.points) || null;

  return (
    <div>
      <h1 className="font-[family-name:var(--font-playfair)] text-2xl">Loyalty</h1>

      <div className="mt-3.5 rounded-2xl border border-border bg-surface shadow-sm">
        <Donut points={data.points} nextReward={nextReward} />
        <div className="flex gap-2 px-4 pb-4">
          {(["rewards", "voucher", "how"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2.5 text-xs font-semibold ${tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {t === "rewards" ? "Overview" : t === "voucher" ? "Voucher" : "How it works"}
            </button>
          ))}
        </div>
      </div>

      {tab === "rewards" && (
        <>
          <div className="mb-2 mt-6 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Redeem your points</div>
          <div className="rounded-2xl border border-border bg-surface shadow-sm">
            {data.rewards.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No rewards available right now.</div>
            ) : (
              data.rewards.map((r) => (
                <RewardRow key={r.id} reward={r} points={data.points} busy={busy} onRedeem={() => setConfirmReward(r)} />
              ))
            )}
          </div>
        </>
      )}

      {tab === "voucher" && (
        <div className="mt-3.5 rounded-2xl border border-border bg-surface shadow-sm">
          <VoucherPanel redemption={data.activeRedemption} onCancel={cancel} busy={busy} />
        </div>
      )}

      {tab === "how" && (
        <>
          <div className="mb-1 mt-6 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Redeem rewards</div>
          <p className="mb-3 px-0.5 text-[13.5px] text-muted-foreground">Simple steps to redeem your points at checkout.</p>
          <div className="rounded-2xl border border-border bg-surface shadow-sm">
            {[
              { n: 1, t: "Apply a reward at checkout", d: "When you have enough points, choose a reward to apply toward your order total during checkout." },
              { n: 2, t: "One reward per transaction", d: "Only one reward may be redeemed per transaction. If the reward doesn't cover the full total, complete the payment using your card for the remaining balance. You may also apply a reward with a value larger than the order total." },
              { n: 3, t: "No cash value & enjoy", d: "Loyalty rewards have no cash value and cannot be redeemed for cash. Once your points are successfully redeemed, enjoy the discount, free item, or perk — and make the most of your loyalty benefit." },
            ].map((s) => (
              <div key={s.n} className="flex gap-3.5 border-b border-border px-4 py-4 last:border-b-0">
                <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary font-[family-name:var(--font-playfair)] text-sm text-primary-foreground">
                  {s.n}
                </div>
                <div>
                  <div className="mb-0.5 font-semibold">{s.t}</div>
                  <div className="text-[13px] leading-relaxed text-muted-foreground">{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {confirmReward && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setConfirmReward(null)}>
          <div className="w-full max-w-lg rounded-t-2xl bg-surface p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3.5 h-1 w-9 rounded-full bg-border" />
            <h3 className="text-xl font-semibold">Redeem {confirmReward.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              This creates a voucher number to give at the till. Your {confirmReward.points_cost} points are redeemed now.
            </p>
            {data.activeRedemption && (
              <p className="mt-2 text-sm text-amber-600">
                You already have an active voucher ({data.activeRedemption.reward?.name}). Creating a new one isn&apos;t possible until it&apos;s cancelled or used.
              </p>
            )}
            {msg && <p className="mt-2 text-sm text-red-500">{msg}</p>}
            <div className="mt-4 flex justify-between border-t border-border pt-3 text-sm">
              <span className="text-muted-foreground">Cost</span>
              <b>{confirmReward.points_cost} points</b>
            </div>
            <button
              onClick={() => redeem(confirmReward.id)}
              disabled={busy}
              className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "Confirming…" : "Confirm & create voucher"}
            </button>
            <button onClick={() => setConfirmReward(null)} className="mt-2.5 w-full rounded-xl bg-muted py-3 text-sm font-semibold">
              Not now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoyaltyView() {
  return (
    <Suspense fallback={null}>
      <LoyaltyInner />
    </Suspense>
  );
}
