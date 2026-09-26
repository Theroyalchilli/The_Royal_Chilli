"use client";

// TEMPORARY — prints through the browser's print dialog (the printer is on
// the till PC's USB) until the Star printer is on the network for CloudPRNT.
// Remove with app/pos/print/[kind]/[id] once CloudPRNT printing works.
export default function BrowserPrintButton({
  kind,
  id,
  className,
}: {
  kind: "receipt" | "kot" | "zreport";
  id: number | null;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={!id}
      title="Print through this computer's print dialog"
      onClick={() => id && window.open(`/pos/print/${kind}/${id}`, "_blank", "width=420,height=640")}
      className={
        className ??
        "shrink-0 px-3 rounded-lg border border-border bg-surface-hover hover:bg-elevated text-foreground text-xs font-semibold disabled:opacity-40"
      }
    >
      🖥️ Browser
    </button>
  );
}
