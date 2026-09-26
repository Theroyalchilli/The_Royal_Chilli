import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { buildTicket, LINE_WIDTH, type PrintJob } from "@/lib/cloudprnt";
import AutoPrint from "@/app/pos/kitchen/print/[orderId]/AutoPrint";
import PrintNav from "@/app/pos/kitchen/print/[orderId]/PrintNav";

// TEMPORARY browser-print fallback, for while the Star printer isn't on the
// network yet (it's connected to the till PC by USB, so the browser's print
// dialog reaches it). Renders the exact ticket CloudPRNT would print
// (lib/cloudprnt.ts). Remove this page and the "Browser" buttons
// (components/pos/BrowserPrintButton.tsx) once CloudPRNT printing works.
//
// /pos/print/receipt/<orderId>, /pos/print/kot/<orderId>, /pos/print/zreport/<workPeriodId>
export default async function BrowserPrintPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { kind, id } = await params;
  const n = Number(id);
  if ((kind !== "receipt" && kind !== "kot" && kind !== "zreport") || !Number.isInteger(n) || n <= 0) {
    return <div style={{ padding: 20, fontFamily: "monospace" }}>Nothing to print.</div>;
  }

  const job: PrintJob = {
    id: 0,
    kind,
    order_id: kind === "zreport" ? null : n,
    work_period_id: kind === "zreport" ? n : null,
    source: null, // kitchen ticket labelled REPRINT
    item_ids: null,
  };
  const ticket = await buildTicket(job);
  if (!ticket) return <div style={{ padding: 20, fontFamily: "monospace" }}>Nothing to print.</div>;

  return (
    <>
      <AutoPrint />
      <PrintNav />
      <div className="ticket">
        {ticket.map((l, i) => (
          <div key={i} className={`line ${l.align === "center" ? "center" : ""} ${l.bold ? "bold" : ""} ${l.size ?? ""}`}>
            {l.text || " "}
          </div>
        ))}
      </div>

      <style>{`
        body { background: #fff; }
        /* ${LINE_WIDTH} columns across 72mm of printable width, like the printer's Font A. */
        .ticket { width: 72mm; margin: 0 auto; padding: 4mm 0; font-family: 'Courier New', monospace; color: #000; font-size: 2.5mm; line-height: 1.35; }
        .line { white-space: pre; overflow: hidden; }
        .center { text-align: center; }
        .bold { font-weight: 700; }
        .tall { font-size: 3.4mm; font-weight: 700; }
        .big { font-size: 5mm; font-weight: 700; }
        @media print {
          @page { size: 80mm auto; margin: 0; }
          body { margin: 0; }
          .no-print { display: none; }
        }
      `}</style>
    </>
  );
}
