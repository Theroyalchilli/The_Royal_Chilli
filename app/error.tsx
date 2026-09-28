"use client";

import { useEffect, useState } from "react";
import { reloadOnceForStaleVersion } from "@/lib/chunk-error";

// Any page that crashes — website, account, till or Staff Hub — lands here
// instead of the bare "Application error" text. An out-of-date page (opened
// before a new version went live) reloads itself once, silently.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    console.error("[page error]", error);
    if (reloadOnceForStaleVersion(error)) setReloading(true);
  }, [error]);

  if (reloading) {
    return <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">Updating to the latest version…</div>;
  }

  return (
    <div className="mx-auto grid min-h-[60vh] max-w-sm place-items-center px-6 text-center">
      <div>
        <div className="text-4xl">🌶️</div>
        <h1 className="mt-3 font-[family-name:var(--font-playfair)] text-2xl">Sorry — something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">Please try again. If it keeps happening, call us on 020 8797 3044.</p>
        <div className="mt-5 flex gap-2">
          <button onClick={() => window.location.reload()} className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">
            Reload page
          </button>
          <button onClick={() => { reset(); window.location.href = "/"; }} className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold">
            Go to home
          </button>
        </div>
        {error.digest && <p className="mt-4 text-[11px] text-muted-foreground">Error ref: {error.digest}</p>}
      </div>
    </div>
  );
}
