"use client";

import { useEffect, useState } from "react";

const CONSENT_KEY = "rc_cookie_consent";

// Starts hidden (matches server render) and only appears after mount, once,
// until the visitor actually makes a choice — localStorage (not session),
// since consent should persist across visits, not just the current tab.
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(CONSENT_KEY)) setVisible(true);
    } catch {
      // localStorage unavailable (private mode etc.) — skip rather than nag every load
    }
  }, []);

  function choose(value: "accepted" | "declined") {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch {
      // ignore — worst case the banner shows again next visit
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] border-t border-border bg-surface px-4 py-4 shadow-[0_-2px_10px_rgba(0,0,0,0.08)]">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
        <p className="flex-1 text-sm text-muted-foreground">
          We use cookies to keep the site working and to understand how it's used. You can accept all cookies or
          decline non-essential ones.
        </p>
        <div className="flex flex-shrink-0 gap-2">
          <button
            onClick={() => choose("declined")}
            className="rounded-lg border border-border px-4 py-2 text-xs uppercase tracking-[0.1em] text-foreground hover:bg-background"
          >
            Decline
          </button>
          <button
            onClick={() => choose("accepted")}
            className="rounded-lg bg-primary px-4 py-2 text-xs uppercase tracking-[0.1em] text-primary-foreground hover:opacity-90"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
