import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getTillReader } from "@/lib/till-reader";

// Any staff taking payments needs to know whether a card reader is set up
// (and which kind) — deliberately doesn't expose the reader id itself.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { provider } = await getTillReader(session.businessId);
  return NextResponse.json({ enabled: provider !== "none", provider });
}
