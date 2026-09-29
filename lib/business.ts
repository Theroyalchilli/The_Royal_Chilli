import supabase from "@/lib/supabase";
import { DEFAULT_BUSINESS_ID } from "@/lib/business-id";

// Several businesses (The Royal Chilli, Melt House, …) run on this one system
// (migration 076). Each staff login and each paired till carries the business
// it's working for; server code reads and writes that business's rows through
// lib/business-db.ts. Anything that doesn't say which business it is — an
// older login, a token from the attendance app — is The Royal Chilli.

export { DEFAULT_BUSINESS_ID };

export type BusinessModules = {
  till: boolean; kitchen_display: boolean; tables: boolean; qr_ordering: boolean;
  website: boolean; online_ordering: boolean; delivery: boolean; reservations: boolean;
  inventory: boolean; rewards: boolean; food_safety: boolean; delivery_platforms: boolean;
};

export type Business = {
  id: number;
  slug: string;
  name: string;
  legal_name: string | null;
  company_number: string | null;
  vat_number: string | null;
  domain: string | null;
  logo_url: string | null;
  brand_colour: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  modules: BusinessModules;
  active: boolean;
  display_order: number;
};

// The list changes rarely; keep it for a minute per server instance.
const TTL_MS = 60_000;
let cache: { at: number; list: Business[] } | null = null;

export async function listBusinesses(): Promise<Business[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.list;
  const { data, error } = await supabase.from("businesses").select("*").order("display_order").order("id");
  if (error) throw error;
  cache = { at: Date.now(), list: (data ?? []) as Business[] };
  return cache.list;
}

export function clearBusinessCache() {
  cache = null;
}

export async function getBusiness(id: number): Promise<Business | null> {
  return (await listBusinesses()).find((b) => b.id === id) ?? null;
}

const bareHost = (host: string) => host.toLowerCase().split(":")[0].replace(/^www\./, "");

/** The business whose website is on this domain (www. ignored), or null. */
export async function businessForHost(host: string | null | undefined): Promise<Business | null> {
  if (!host) return null;
  const h = bareHost(host);
  return (await listBusinesses()).find((b) => b.domain && bareHost(b.domain) === h) ?? null;
}

/** Active businesses this staff member works at, in display order. */
export async function staffBusinessIds(staffId: number): Promise<number[]> {
  const { data, error } = await supabase.from("staff_businesses").select("business_id").eq("staff_id", staffId).eq("active", true);
  if (error) throw error;
  const ids = new Set((data ?? []).map((r) => r.business_id as number));
  return (await listBusinesses()).filter((b) => ids.has(b.id)).map((b) => b.id);
}

/**
 * Which business a password login works for: the one whose domain they're on
 * if they work there, otherwise the first one they work at. null = they aren't
 * set up at any business.
 */
export async function loginBusinessId(staffId: number, host: string | null | undefined): Promise<number | null> {
  const ids = await staffBusinessIds(staffId);
  if (ids.length === 0) return null;
  const onDomain = await businessForHost(host);
  return onDomain && ids.includes(onDomain.id) ? onDomain.id : ids[0];
}

/** Link a (new) staff member to a business, or update their role there. */
export async function linkStaffToBusiness(staffId: number, businessId: number, role: string): Promise<void> {
  const { error } = await supabase.from("staff_businesses")
    .upsert({ staff_id: staffId, business_id: businessId, role, active: true }, { onConflict: "staff_id,business_id" });
  if (error) throw error;
}

/**
 * The business a public web request is for — decided by the domain it came
 * in on, so each business's website shows its own menu. Unknown domains
 * (the vercel.app address, localhost) are The Royal Chilli.
 */
export async function websiteBusinessId(host: string | null | undefined, pick?: string | null): Promise<number> {
  // ?b=<slug> — for a business whose QR codes / links use a shared address
  // (no domain of its own yet). Only an active business can be picked.
  if (pick) {
    const b = (await listBusinesses()).find((x) => x.active && x.slug === pick.trim().toLowerCase());
    if (b) return b.id;
  }
  return (await businessForHost(host))?.id ?? DEFAULT_BUSINESS_ID;
}

/** websiteBusinessId for a server-rendered page. */
export async function pageBusinessId(): Promise<number> {
  const { headers } = await import("next/headers");
  return websiteBusinessId((await headers()).get("host"));
}

/**
 * For routes used by both the till and the website: a signed-in staff member
 * works for their login's business; anyone else gets the domain's business.
 */
export async function requestBusinessId(req: { headers: Headers; cookies: { get(name: string): { value: string } | undefined } }): Promise<number> {
  const { getSessionFromRequest } = await import("@/lib/auth");
  const session = await getSessionFromRequest(req as Parameters<typeof getSessionFromRequest>[0]);
  return session?.businessId ?? websiteBusinessId(req.headers.get("host"));
}

/** Ids of the (shared) staff who work at this business. */
export async function staffIdsAt(businessId: number): Promise<number[]> {
  const { data, error } = await supabase.from("staff_businesses").select("staff_id").eq("business_id", businessId).eq("active", true);
  if (error) throw error;
  return (data ?? []).map((r) => r.staff_id as number);
}

/** Short prefix for this business's order numbers: RC-20260929-001, MH-…  */
export async function orderNumberPrefix(businessId: number): Promise<string> {
  if (businessId === DEFAULT_BUSINESS_ID) return "RC";
  const b = await getBusiness(businessId);
  const parts = (b?.slug ?? `b${businessId}`).split("-").filter(Boolean);
  return (parts.length > 1 ? parts.map((p) => p[0]).join("") : parts[0].slice(0, 2)).toUpperCase();
}
