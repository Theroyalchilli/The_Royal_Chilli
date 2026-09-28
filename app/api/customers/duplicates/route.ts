import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageCrm } from "@/lib/permissions";
import { countVisits } from "@/lib/crm";
import { findDuplicateGroups } from "@/lib/customer-duplicates";

export const dynamic = "force-dynamic";

// GET — possible duplicate customer records (same mobile / email / name),
// with enough about each to decide which to keep. Managers only.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageCrm(session.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, phone, email, password_hash, loyalty_points, created_at")
    .is("merged_into", null);
  const { data: orders } = await supabase.from("orders").select("customer_id, created_at").eq("is_paid", true).not("customer_id", "is", null);

  const ordersBy = new Map<number, { created_at: string }[]>();
  for (const o of orders ?? []) ordersBy.set(o.customer_id, [...(ordersBy.get(o.customer_id) ?? []), o]);

  const rows = (customers ?? []).map((c) => {
    const mine = ordersBy.get(c.id) ?? [];
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      has_account: !!c.password_hash,
      loyalty_points: c.loyalty_points,
      visits: countVisits(mine),
      last_visit: mine.reduce<string | null>((m, o) => (!m || o.created_at > m ? o.created_at : m), null),
      created_at: c.created_at,
    };
  });
  return NextResponse.json({ groups: findDuplicateGroups(rows) });
}
