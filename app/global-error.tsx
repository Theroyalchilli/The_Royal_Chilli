"use client";

import { useEffect, useState } from "react";
import { reloadOnceForStaleVersion } from "@/lib/chunk-error";

// Last line of defence: a crash in the root layout itself. It replaces the
// whole page (no site CSS loaded), so styles are inline.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    console.error("[global error]", error);
    if (reloadOnceForStaleVersion(error)) setReloading(true);
  }, [error]);

  const btn = { flex: 1, padding: "12px 16px", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer" } as const;
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#FFFBEB", color: "#201B18", fontFamily: "Arial, Helvetica, sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          {reloading ? (
            <p style={{ fontSize: 14, color: "#7C716A" }}>Updating to the latest version…</p>
          ) : (
            <div style={{ maxWidth: 360 }}>
              <div style={{ fontSize: 40 }}>🌶️</div>
              <h1 style={{ fontFamily: "Georgia, serif", fontSize: 24, margin: "12px 0 8px" }}>Sorry — something went wrong</h1>
              <p style={{ fontSize: 14, color: "#7C716A", margin: 0 }}>Please try again. If it keeps happening, call us on 020 8797 3044.</p>
              <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                <button onClick={() => window.location.reload()} style={{ ...btn, background: "#E34234", color: "#fff", border: "none" }}>Reload page</button>
                <button onClick={() => (window.location.href = "/")} style={{ ...btn, background: "transparent", color: "#201B18", border: "1px solid #EFE4C9" }}>Go to home</button>
              </div>
              {error.digest && <p style={{ fontSize: 11, color: "#7C716A", marginTop: 16 }}>Error ref: {error.digest}</p>}
            </div>
          )}
        </div>
      </body>
    </html>
  );
}
