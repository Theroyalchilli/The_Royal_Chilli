import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { buildTicket, type PrintJob } from "@/lib/cloudprnt";
import { BROWSER_TICKET_WIDTH, lineClass, TICKET_CSS } from "@/lib/ticket-html";
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
  const ticket = await buildTicket(job, BROWSER_TICKET_WIDTH);
  if (!ticket) return <div style={{ padding: 20, fontFamily: "monospace" }}>Nothing to print.</div>;

  return (
    <>
      <AutoPrint />
      <PrintNav />
      <div className="ticket">
        {ticket.map((l, i) => (
          <div key={i} className={lineClass(l)}>
            {l.text || " "}
          </div>
        ))}
      </div>

      <style>{TICKET_CSS}</style>
    </>
  );
}
