import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { queueKitchenTicket, queueReceipt } from "@/lib/print-queue";

// Staff "Print Receipt" / "Reprint Receipt" / "Print KOT" buttons — sends the
// ticket to the CloudPRNT printer queue instead of the browser's print dialog.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { order_id, kind } = await req.json().catch(() => ({}));
  const orderId = Number(order_id);
  if (!Number.isInteger(orderId) || orderId <= 0 || (kind !== "kot" && kind !== "receipt")) {
    return NextResponse.json({ error: "order_id and kind ('kot' or 'receipt') are required" }, { status: 400 });
  }

  try {
    if (kind === "receipt") await queueReceipt(orderId);
    else await queueKitchenTicket(orderId, null); // null source = labelled REPRINT
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Queue print job error:", error);
    return NextResponse.json({ error: "Failed to send to printer" }, { status: 500 });
  }
}
