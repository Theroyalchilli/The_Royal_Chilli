import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { buildTicket, type PrintJob } from "@/lib/cloudprnt";
import AutoPrint from "@/app/pos/kitchen/print/[orderId]/AutoPrint";
import PrintNav from "@/app/pos/kitchen/print/[orderId]/PrintNav";

// TEMPORARY browser-print fallback, for while the Star printer isn't on the
// network yet (it's connected to the till PC by USB, so the browser's print
// dialog reaches it). Renders the exact ticket CloudPRNT would print
// (lib/cloudprnt.ts). Remove this page and the "Browser" buttons
// (components/pos/BrowserPrintButton.tsx) once CloudPRNT printing works.
//
// /pos/print/receipt/<orderId>, /pos/print/kot/<orderId>, /pos/print/zreport/<workPeriodId>

// 38 columns instead of the printer's 48, so the text can be ~25% bigger and
// still fit the 72mm the Star MCP30 driver prints.
const WIDTH = 38;
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
  const ticket = await buildTicket(job, WIDTH);
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
        body { background: #fff; margin: 0; }
        /* The Star MCP30 driver's paper is "72mm x Receipt" and 72mm is all the
           print head can reach, so the page is exactly that wide and starts at
           the left edge. Courier is 0.6em per character: ${WIDTH} columns at
           3.06mm = 69.8mm, leaving a little slack so the last column never clips.
           "tall" is double height only (still ${WIDTH} columns), "big" is
           double width (${WIDTH / 2} columns). Anything longer wraps. */
        .ticket { width: 72mm; margin: 0; padding: 3mm 0; font-family: 'Courier New', monospace; color: #000; font-size: 3.06mm; line-height: 1.3; }
        .line { white-space: pre-wrap; word-break: break-all; }
        .center { text-align: center; }
        .bold { font-weight: 700; }
        .tall { font-weight: 700; transform: scaleY(1.5); transform-origin: 0 0; margin-bottom: 0.5em; }
        .big { font-size: 6.1mm; font-weight: 700; }
        @media print {
          @page { size: 72mm auto; margin: 0; }
          .no-print { display: none; }
        }
      `}</style>
    </>
  );
}
