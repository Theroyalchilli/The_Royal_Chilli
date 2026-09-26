"use client";

import { useState } from "react";

// Sends a receipt or kitchen ticket to the CloudPRNT printer queue
// (app/api/print) — the printer picks it up within a few seconds, so there's
// no browser print dialog.
export default function PrintButton({
  orderId,
  kind,
  label,
  className,
}: {
  orderId: number | null;
  kind: "kot" | "receipt";
  label: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  const send = async () => {
    if (!orderId || state === "sending") return;
    setState("sending");
    try {
      const res = await fetch("/api/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, kind }),
      });
      setState(res.ok ? "sent" : "failed");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 3000);
  };

  const text = { idle: label, sending: "Sending…", sent: "✓ Sent to printer", failed: "⚠️ Failed — try again" }[state];

  return (
    <button onClick={send} disabled={!orderId || state === "sending"} className={className}>
      {text}
    </button>
  );
}
