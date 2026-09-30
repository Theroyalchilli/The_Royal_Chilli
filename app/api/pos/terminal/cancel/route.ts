import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { cancelReaderCheckout } from "@/lib/sumup";
import { getTillReader } from "@/lib/till-reader";

// Lets staff back out of an in-progress reader charge (customer changed their
// mind, reader stuck) without leaving it hanging. Only possible while the
// reader is still waiting for card/PIN input.
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const reader = await getTillReader(session.businessId);
    if (reader.provider === "none") {
      return NextResponse.json({ error: "No card reader is configured" }, { status: 400 });
    }

    if (reader.provider === "sumup") {
      await cancelReaderCheckout(reader.readerId);
    } else {
      if (!stripe) return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
      await stripe.terminal.readers.cancelAction(reader.readerId);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Terminal cancel error:", error);
    return NextResponse.json({ error: "Failed to cancel" }, { status: 500 });
  }
}
