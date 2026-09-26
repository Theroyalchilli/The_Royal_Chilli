import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";
import supabase from "@/lib/supabase";

// The USB Print Station (app/pos/print-station) — a till laptop with the Star
// printer on USB, printing the print_jobs queue while the printer can't reach
// the internet for CloudPRNT. It runs unattended all day, longer than a staff
// login lasts, so a manager pairs it once and it gets its own key. The key
// can only fetch and mark off print jobs — nothing else in the POS accepts it.
//
// Only a SHA-256 hash is stored (app_settings.print_station_key_hash), and
// pairing again replaces it, so there's only ever one station and a lost
// laptop is cut off by pairing another.

const SETTING = "print_station_key_hash";
const hash = (key: string) => createHash("sha256").update(key).digest("hex");

export async function pairPrintStation(): Promise<string> {
  const key = randomBytes(32).toString("base64url");
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: SETTING, value: hash(key), updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
  return key;
}

export async function isPrintStation(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const given = Buffer.from(hash(auth.slice(7).trim()));

  const { data } = await supabase.from("app_settings").select("value").eq("key", SETTING).maybeSingle();
  const stored = typeof data?.value === "string" ? Buffer.from(data.value) : null;
  return !!stored && stored.length === given.length && timingSafeEqual(stored, given);
}
