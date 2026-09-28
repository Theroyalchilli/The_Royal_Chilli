"use client";

import { useState } from "react";
import Link from "next/link";

export default function ClaimButton({ o, k, name }: { o: string; k: string; name: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [msg, setMsg] = useState("");

  async function claim() {
    setState("busy");
    setMsg("");
    const res = await fetch("/api/account/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ o, k }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setState("idle");
      setMsg(d.error || "Something went wrong");
      return;
    }
    setState("done");
    setMsg(`${d.points} points added${d.balance != null ? ` — you now have ${d.balance}` : ""}.`);
  }

  if (state === "done") {
    return (
      <div className="mt-6">
        <p className="text-lg font-semibold text-emerald-700">🎉 {msg}</p>
        <Link href="/account/loyalty" className="mt-4 inline-block rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
          See my rewards
        </Link>
      </div>
    );
  }
  return (
    <div className="mt-6">
      <button onClick={claim} disabled={state === "busy"} className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        {state === "busy" ? "Adding…" : `Add to ${name.split(" ")[0]}'s account`}
      </button>
      {msg && <p className="mt-3 text-sm text-red-600">{msg}</p>}
    </div>
  );
}
