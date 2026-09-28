"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatUkMobile } from "@/lib/phone";

// Staff Hub → Customers → Possible duplicates (managers): records that share a
// mobile, email or name. Pick the one to keep → Merge: orders, points, visits,
// vouchers and bookings all move onto it (lib/customer-merge.ts).

type Rec = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  has_account: boolean;
  loyalty_points: number;
  visits: number;
  last_visit: string | null;
  created_at: string;
};
type Group = { reasons: ("mobile" | "email" | "name")[]; members: Rec[] };

const REASON: Record<string, string> = { mobile: "same mobile", email: "same email", name: "same name" };
const d = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }) : "—");

export default function DuplicatesPanel({ onClose, onMerged }: { onClose: () => void; onMerged: () => void }) {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [review, setReview] = useState<Group | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const res = await fetch("/api/customers/duplicates", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    setGroups(data.groups ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Possible duplicates</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Customers who may be the same person. Merging puts their orders, points, visits and vouchers on one record.
        </p>

        {!groups ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : groups.length === 0 ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">✓ No duplicates found.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {groups.map((g) => (
              <div key={g.members.map((m) => m.id).join("-")} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-foreground">
                    {g.members[0].name} ×{g.members.length}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">{g.reasons.map((r) => REASON[r]).join(" · ")}</span>
                  </div>
                  <button onClick={() => setReview(g)} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500">Review</button>
                </div>
                <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  {g.members.map((m) => (
                    <li key={m.id}>
                      #{m.id} · {m.phone ? formatUkMobile(m.phone) : "no mobile"} · {m.email ?? "no email"} · {m.has_account ? "website account" : "guest"} · {m.loyalty_points} pts · {m.visits} visit{m.visits === 1 ? "" : "s"}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {review && (
        <MergeReview
          group={review}
          onClose={() => setReview(null)}
          onDone={(msg) => {
            setReview(null);
            toast({ variant: "success", title: msg });
            load();
            onMerged();
          }}
        />
      )}
    </div>
  );
}

function MergeReview({ group, onClose, onDone }: { group: Group; onClose: () => void; onDone: (msg: string) => void }) {
  // Default: keep the record with a website login, else the most points.
  const suggested = [...group.members].sort((a, b) => Number(b.has_account) - Number(a.has_account) || b.loyalty_points - a.loyalty_points)[0];
  const [keepId, setKeepId] = useState(suggested.id);
  const [merge, setMerge] = useState<Set<number>>(new Set(group.members.filter((m) => m.id !== suggested.id).map((m) => m.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const keep = group.members.find((m) => m.id === keepId)!;
  const dropping = group.members.filter((m) => m.id !== keepId && merge.has(m.id));
  const loginsLost = dropping.filter((m) => m.has_account);
  const totalPoints = keep.loyalty_points + dropping.reduce((s, m) => s + m.loyalty_points, 0);

  function chooseKeep(id: number) {
    setKeepId(id);
    setMerge(new Set(group.members.filter((m) => m.id !== id).map((m) => m.id)));
  }

  async function run() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/customers/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keep_id: keepId, drop_ids: dropping.map((m) => m.id) }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "Merge failed");
    onDone(`Merged ${dropping.length} record${dropping.length === 1 ? "" : "s"} into #${keepId}`);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5">
        <h3 className="font-bold text-foreground">Merge {group.members[0].name}</h3>
        <p className="mt-1 text-xs text-muted-foreground">Pick the record to keep, and tick which others are the same person.</p>

        <div className="mt-3 space-y-2">
          {group.members.map((m) => {
            const isKeep = m.id === keepId;
            return (
              <div key={m.id} className={`rounded-lg border p-2.5 text-xs ${isKeep ? "border-emerald-500 bg-emerald-50" : "border-border bg-background"}`}>
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 font-semibold text-foreground">
                    <input type="radio" checked={isKeep} onChange={() => chooseKeep(m.id)} />
                    #{m.id} {m.name} {isKeep && <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] text-white">KEEP</span>}
                  </label>
                  {!isKeep && (
                    <label className="flex items-center gap-1 text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={merge.has(m.id)}
                        onChange={(e) => {
                          const next = new Set(merge);
                          if (e.target.checked) next.add(m.id);
                          else next.delete(m.id);
                          setMerge(next);
                        }}
                      />
                      merge in
                    </label>
                  )}
                </div>
                <div className="mt-1 text-muted-foreground">
                  {m.phone ? formatUkMobile(m.phone) : "no mobile"} · {m.email ?? "no email"} · {m.has_account ? "🔑 website login" : "guest"}
                  <br />
                  {m.loyalty_points} pts · {m.visits} visit{m.visits === 1 ? "" : "s"} · last {d(m.last_visit)} · joined {d(m.created_at)}
                </div>
              </div>
            );
          })}
        </div>

        {dropping.length > 0 && (
          <div className="mt-3 rounded-lg bg-surface-hover p-2.5 text-xs text-foreground">
            After merging: <b>#{keep.id}</b> has about <b>{totalPoints} pts</b> and all the orders and vouchers. Missing mobile/email is filled in
            from the others. Only one welcome offer is kept.
            {loginsLost.length > 0 && (
              <p className="mt-1 font-semibold text-amber-700">
                ⚠️ {loginsLost.map((m) => `#${m.id}`).join(", ")} {loginsLost.length === 1 ? "has" : "have"} a website login that will stop working — only #{keep.id}&apos;s
                {keep.has_account ? " login" : " (no login yet — they can sign up with the same email or mobile)"} stays.
              </p>
            )}
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="h-10 flex-1 rounded-xl bg-elevated font-semibold text-foreground hover:bg-elevated-hover">Cancel</button>
          <button onClick={run} disabled={busy || dropping.length === 0} className="h-10 flex-1 rounded-xl bg-red-600 font-semibold text-white hover:bg-red-500 disabled:opacity-50">
            {busy ? "Merging…" : `Merge ${dropping.length} into #${keepId}`}
          </button>
        </div>
      </div>
    </div>
  );
}
