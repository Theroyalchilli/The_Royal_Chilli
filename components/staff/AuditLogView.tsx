"use client";

import { useEffect, useState } from "react";

type LogEntry = {
  id: number;
  staff_name: string;
  action: string;
  entity_type: string;
  entity_id: number | null;
  changes: Record<string, unknown> | null;
  created_at: string;
};

export default function AuditLogView() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/audit-logs")
      .then((r) => r.json())
      .then((d) => setLogs(d.logs || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur px-4 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between flex-wrap gap-3">
          <div>
            <h1 style={{ fontFamily: "var(--font-space-grotesk)" }} className="text-foreground text-[22px] font-semibold tracking-[-0.02em]">Audit Log</h1>
            <p className="text-muted-foreground text-sm">A read-only history of who changed what, across every module.</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-6">
      <div className="mx-auto max-w-4xl">
        <div className="mt-5 space-y-1.5">
          {loading ? (
            <div className="text-muted-foreground text-center py-16">Loading…</div>
          ) : logs.length === 0 ? (
            <div className="text-muted-foreground text-center py-16">No activity recorded yet.</div>
          ) : (
            logs.map((l) => (
              <div key={l.id} className="rounded-lg border border-border bg-surface shadow-[0_1px_2px_rgba(32,27,24,0.04),0_8px_24px_rgba(32,27,24,0.05)] px-4 py-2.5 flex items-start justify-between gap-3 flex-wrap">
                <div className="text-sm">
                  <span className="text-foreground font-semibold">{l.staff_name}</span>
                  <span className="text-muted-foreground"> {l.action} </span>
                  <span className="text-red-600">{l.entity_type}</span>
                  {l.entity_id && <span className="text-muted-foreground"> #{l.entity_id}</span>}
                  {l.changes && <span className="text-muted-foreground text-xs block mt-0.5">{JSON.stringify(l.changes)}</span>}
                </div>
                <span className="text-muted-foreground text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleString("en-GB")}</span>
              </div>
            ))
          )}
        </div>
      </div>
      </div>
    </>
  );
}
