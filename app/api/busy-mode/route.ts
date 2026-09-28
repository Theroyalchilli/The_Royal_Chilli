import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { busyState, endOfTradingDay, NORMAL_MODE, type BusyMode } from "@/lib/busy-mode";

export const dynamic = "force-dynamic";

async function readMode(): Promise<BusyMode> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "busy_mode").maybeSingle();
  return (data?.value as BusyMode) ?? NORMAL_MODE;
}

// GET — current busy state (public: the website reads it at checkout).
export async function GET() {
  return NextResponse.json(busyState(await readMode()));
}

// POST — set from the till by any staff member:
// { action: "pause", minutes: 30 | 60 | null }  (null = until closing)
// { action: "extra", minutes: 15 | 30 | 45 }    (until closing)
// { action: "normal" }
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const current = await readMode();
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

  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "busy_mode", value: next, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  revalidatePath("/order");
  return NextResponse.json(busyState(next));
}
