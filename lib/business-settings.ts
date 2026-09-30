import supabase from "@/lib/supabase";

// Each business's own settings (business_settings, migration 080) — opening
// hours, busy mode, booking deposit, website text, card reader, clock-in
// location… What used to be one shared list (app_settings) for everyone.
//
// (app_settings now only holds the print-station device keys.)

/** All of a business's settings, or just `keys`, as { key: value }. */
export async function getBusinessSettings(businessId: number, keys?: readonly string[]): Promise<Record<string, unknown>> {
  let q = supabase.from("business_settings").select("key, value").eq("business_id", businessId);
  if (keys) q = q.in("key", keys as string[]);
  const { data, error } = await q;
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.key as string, r.value]));
}

/** One setting (undefined when not set). */
export async function getBusinessSetting<T = unknown>(businessId: number, key: string): Promise<T | undefined> {
  const { data } = await supabase.from("business_settings").select("value").eq("business_id", businessId).eq("key", key).maybeSingle();
  return (data?.value ?? undefined) as T | undefined;
}

/** A number setting, with a fallback when it's missing or not a number. */
export async function getBusinessNumber(businessId: number, key: string, fallback: number): Promise<number> {
  const n = Number((await getBusinessSetting(businessId, key)) ?? fallback);
  return isNaN(n) ? fallback : n;
}

/** Save some of a business's settings. */
export async function saveBusinessSettings(businessId: number, values: Record<string, unknown>): Promise<void> {
  const now = new Date().toISOString();
  const entries = Object.entries(values);
  if (entries.length === 0) return;
  const { error } = await supabase
    .from("business_settings")
    .upsert(entries.map(([key, value]) => ({ business_id: businessId, key, value, updated_at: now })), { onConflict: "business_id,key" });
  if (error) throw error;
}
