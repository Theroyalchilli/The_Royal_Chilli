import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";
import supabase from "@/lib/supabase";
import { DEFAULT_BUSINESS_ID } from "@/lib/business-id";

// The USB Print Station (app/pos/print-station) — a till laptop with the Star
// printer on USB, printing the print_jobs queue while the printer can't reach
// the internet for CloudPRNT. It runs unattended all day, longer than a staff
// login lasts, so a manager pairs it once and it gets its own key. The key
// can only fetch and mark off print jobs — nothing else in the POS accepts it.
//
// Only a SHA-256 hash is stored in app_settings, one per business
// (print_station_key_hash for The Royal Chilli, print_station_key_hash:<id>
// for the others), and pairing again replaces it — one station per business,
// and a lost laptop is cut off by pairing another. The key says which
// business's tickets the station prints.

const SETTING = "print_station_key_hash";
const settingFor = (businessId: number) => (businessId === DEFAULT_BUSINESS_ID ? SETTING : `${SETTING}:${businessId}`);
const businessOf = (settingKey: string) => (settingKey === SETTING ? DEFAULT_BUSINESS_ID : Number(settingKey.slice(SETTING.length + 1)));
const hash = (key: string) => createHash("sha256").update(key).digest("hex");

export async function pairPrintStation(businessId: number): Promise<string> {
  const key = randomBytes(32).toString("base64url");
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: settingFor(businessId), value: hash(key), updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
  return key;
}

/** The business whose Print Station this request comes from, or null. */
export async function printStationBusiness(req: NextRequest): Promise<number | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const given = Buffer.from(hash(auth.slice(7).trim()));

  const { data } = await supabase.from("app_settings").select("key, value").like("key", `${SETTING}%`);
  for (const row of data ?? []) {
    const stored = typeof row.value === "string" ? Buffer.from(row.value) : null;
    if (stored && stored.length === given.length && timingSafeEqual(stored, given)) {
      const bid = businessOf(row.key);
      return Number.isInteger(bid) && bid > 0 ? bid : null;
    }
  }
  return null;
}
