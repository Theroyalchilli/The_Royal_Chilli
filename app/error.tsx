"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { reloadOnceForStaleVersion } from "@/lib/chunk-error";

// Any page that crashes lands here instead of the bare "Application error"
// text. An out-of-date page (opened before a new version went live) reloads
// itself once, silently. Customers get the friendly page; the till / Staff
// Hub / Print Station get a short one.
const STAFF_AREAS = ["/pos", "/staff", "/os", "/pin", "/print-station", "/login"];

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const pathname = usePathname() || "/";
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    console.error("[page error]", error);
    if (reloadOnceForStaleVersion(error)) setReloading(true);
  }, [error]);

  const tryAgain = () => {
    reset();
    window.location.reload();
  };

  if (reloading) {
    return <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">Updating to the latest version…</div>;
  }

  if (STAFF_AREAS.some((a) => pathname === a || pathname.startsWith(`${a}/`))) {
    return (
      <div className="mx-auto grid min-h-[60vh] max-w-sm place-items-center px-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">Something went wrong on this screen</h1>
          <p className="mt-2 text-sm text-muted-foreground">Tap Try again. If it keeps happening, tell a manager.</p>
          <button onClick={tryAgain} className="mt-4 w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white">
            Try again
          </button>
          {error.digest && <p className="mt-3 text-[11px] text-muted-foreground">Error ref: {error.digest}</p>}
        </div>
      </div>
    );
  }

  const primary = "rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground";
  const secondary = "rounded-xl border border-border px-4 py-3 text-sm font-semibold";
  return (
    <div className="mx-auto max-w-md px-6 py-16 text-center">
      <h1 className="font-[family-name:var(--font-playfair)] text-3xl">Oops! We&apos;ve hit a little hiccup. 🌶️</h1>
      <p className="mt-3 text-muted-foreground">Something went wrong while loading this page.</p>
      <p className="mt-1 font-semibold">Don&apos;t worry — the kitchen is still open!</p>
      <p className="mt-3 text-sm text-muted-foreground">
        Please try again, or head back to The Royal Chilli homepage and continue exploring our menu.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button onClick={tryAgain} className={primary}>Try Again</button>
        <a href="/" className={secondary}>Back to Home</a>
      </div>

      <h2 className="mt-10 font-[family-name:var(--font-playfair)] text-xl">Hungry already?</h2>
      <p className="mt-1 text-sm text-muted-foreground">Explore our menu, book a table, or order your favourites online.</p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <a href="/menu" className={secondary}>View Menu</a>
        <a href="/reservations" className={secondary}>Book a Table</a>
        <a href="/order" className={secondary}>Order Online</a>
      </div>

      <p className="mt-8 text-xs text-muted-foreground">If the problem keeps happening, please try refreshing the page or come back in a moment.</p>
      <p className="mt-6 font-[family-name:var(--font-playfair)] text-lg">The Royal Chilli</p>
      <p className="text-xs text-muted-foreground">Authentic Flavours. Memorable Experiences.</p>
      {error.digest && <p className="mt-4 text-[11px] text-muted-foreground">Error ref: {error.digest}</p>}
    </div>
  );
}
