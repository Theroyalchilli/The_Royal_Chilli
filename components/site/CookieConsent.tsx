"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const CONSENT_KEY = "rc_cookie_consent";

// Starts hidden (matches server render) and only appears after mount, once,
// until the visitor dismisses it — localStorage (not session), since that
// should persist across visits, not just the current tab.
//
// A single acknowledgement, not an accept/decline choice: this site only
// ever sets strictly-necessary cookies (login sessions) — there's no
// analytics or advertising cookie for "decline" to actually turn off, so
// offering that choice would be misleading rather than meaningful.
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(CONSENT_KEY)) setVisible(true);
    } catch {
      // localStorage unavailable (private mode etc.) — skip rather than nag every load
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(CONSENT_KEY, "acknowledged");
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
          We only use cookies that are strictly necessary to keep the site working, such as keeping you logged in.
          See our{" "}
          <Link href="/privacy-policy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>{" "}
          for details.
        </p>
        <button
          onClick={dismiss}
          className="flex-shrink-0 rounded-lg bg-primary px-4 py-2 text-xs uppercase tracking-[0.1em] text-primary-foreground hover:opacity-90"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
