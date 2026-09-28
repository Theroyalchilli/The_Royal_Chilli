import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runDailyMemberEmails } from "@/lib/rewards-emails";

// Daily: after-visit emails for yesterday's trading day (first-visit
// thank-you, or "how was your meal?") and the 10-day "come back" nudges —
// opted-in customers only (lib/rewards-emails.ts).
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runDailyMemberEmails());
}
