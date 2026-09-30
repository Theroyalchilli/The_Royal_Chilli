import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromRequest } from "@/lib/auth";
import { busyState, endOfTradingDay, NORMAL_MODE, type BusyMode } from "@/lib/busy-mode";
import { getBusinessSetting, saveBusinessSettings } from "@/lib/business-settings";
import { requestBusinessId } from "@/lib/business";

export const dynamic = "force-dynamic";

async function readMode(businessId: number): Promise<BusyMode> {
  return (await getBusinessSetting<BusyMode>(businessId, "busy_mode")) ?? NORMAL_MODE;
}

// GET — current busy state (public: the website reads it at checkout; the
// till reads its own business's).
export async function GET(req: NextRequest) {
  return NextResponse.json(busyState(await readMode(await requestBusinessId(req))));
}

// POST — set from the till by any staff member:
// { action: "pause", minutes: 30 | 60 | null }  (null = until closing)
// { action: "extra", minutes: 15 | 30 | 45 }    (until closing)
// { action: "normal" }
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const current = await readMode(session.businessId);
  let next: BusyMode;
  if (body.action === "normal") {
    next = NORMAL_MODE;
  } else if (body.action === "pause") {
    const minutes = body.minutes == null ? null : Number(body.minutes);
    if (minutes !== null && (!Number.isInteger(minutes) || minutes <= 0 || minutes > 600)) {
      return NextResponse.json({ error: "Invalid pause length" }, { status: 400 });
    }
    next = { ...current, paused_until: minutes === null ? endOfTradingDay() : new Date(Date.now() + minutes * 60_000).toISOString() };
  } else if (body.action === "extra") {
    const minutes = Number(body.minutes);
    if (![15, 30, 45].includes(minutes)) return NextResponse.json({ error: "Invalid extra time" }, { status: 400 });
    next = { ...current, extra_minutes: minutes, extra_until: endOfTradingDay() };
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  try {
    await saveBusinessSettings(session.businessId, { busy_mode: next });
  } catch {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
  revalidatePath("/order");
  return NextResponse.json(busyState(next));
}
