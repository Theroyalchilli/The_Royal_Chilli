"use client";

import { zReportLines, type ZReport } from "@/lib/z-report";

// On-screen Z report — the same lines, in the same order, as the printed one
// (lib/cloudprnt.ts), so what staff see is what comes out of the printer.
export default function ZReportView({ report, counted }: { report: ZReport; counted?: number | null }) {
  const lines = zReportLines(report, counted === undefined ? report.cash.counted : counted);
  return (
    <div className="rounded-xl border border-border bg-surface-hover px-4 py-3 font-mono text-[12px] leading-5 text-foreground">
      {lines.map((l, i) => {
        switch (l.kind) {
          case "title":
            return <div key={i} className="text-base font-bold">{l.text}</div>;
          case "heading":
            return <div key={i} className="font-bold">{l.text}</div>;
          case "row":
            return (
              <div key={i} className={`flex justify-between gap-3 ${l.bold ? "font-bold" : ""}`}>
                <span className="whitespace-pre">{l.label}</span>
                <span className="whitespace-nowrap">{l.value}</span>
              </div>
            );
          case "text":
            return <div key={i} className={l.muted ? "text-muted-foreground" : ""}>{l.text}</div>;
          case "divider":
            return <div key={i} className="my-1 border-t border-dashed border-border" />;
          default:
            return <div key={i} className="h-3" />;
        }
      })}
    </div>
  );
}
