import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { sendReviewRequests } from "@/lib/order-notifications";

// Daily: "How was your meal?" emails for yesterday's trading day, to
// customers who opted in (lib/order-notifications.ts).
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await sendReviewRequests());
}
