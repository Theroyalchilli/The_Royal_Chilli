"use client";

import { useState } from "react";

export default function UnsubscribeButton({ c, k }: { c: string; k: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");

  async function go() {
    setState("busy");
    setError("");
    const res = await fetch("/api/account/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ c, k }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setState("idle");
      setError(d.error || "Something went wrong");
      return;
    }
    setState("done");
  }

  if (state === "done") {
    return <p className="mt-6 text-lg font-semibold text-emerald-700">✓ You&apos;re unsubscribed from offers emails.</p>;
  }
  return (
    <div className="mt-6">
      <button onClick={go} disabled={state === "busy"} className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        {state === "busy" ? "Updating…" : "Unsubscribe"}
      </button>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
