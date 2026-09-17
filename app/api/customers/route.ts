import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canViewCrm } from "@/lib/permissions";
import { getActiveTiers, tierForSpend, computeSegment } from "@/lib/crm";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canViewCrm(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");

  let query = supabase.from("customers").select("*").order("created_at", { ascending: false });
  if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);

  const { data: customers, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });

  const { data: paidOrders } = await supabase.from("orders").select("customer_id, total, created_at").eq("status", "paid").not("customer_id", "is", null);
  const spendByCustomer = new Map<number, { spend: number; visits: number; lastVisit: string | null }>();
  for (const o of paidOrders || []) {
    const cur = spendByCustomer.get(o.customer_id) || { spend: 0, visits: 0, lastVisit: null };
    cur.spend += Number(o.total);
    cur.visits += 1;
    if (!cur.lastVisit || o.created_at > cur.lastVisit) cur.lastVisit = o.created_at;
    spendByCustomer.set(o.customer_id, cur);
  }

  const tiers = await getActiveTiers();
  const { data: winbackSetting } = await supabase.from("app_settings").select("value").eq("key", "loyalty_winback_days").maybeSingle();
  const winbackDays = Number(winbackSetting?.value ?? 45);
  const now = Date.now();

  const enriched = (customers || []).map((c) => {
    const stats = spendByCustomer.get(c.id) || { spend: 0, visits: 0, lastVisit: null };
    const lifetimeSpend = Math.round(stats.spend * 100) / 100;
    const daysSinceLastVisit = stats.lastVisit ? Math.floor((now - new Date(stats.lastVisit).getTime()) / 86_400_000) : null;
    return {
      ...c,
      lifetime_spend: lifetimeSpend,
      visit_count: stats.visits,
      last_visit: stats.lastVisit,
      tier: tierForSpend(tiers, lifetimeSpend)?.name ?? "Bronze",
      segment: computeSegment({ visitCount: stats.visits, daysSinceLastVisit, lifetimeSpend, winbackDays }),
    };
  });

  return NextResponse.json({ customers: enriched });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canViewCrm(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { name, phone, email, date_of_birth, address, referred_by_code } = await req.json();
    if (!name || !phone) return NextResponse.json({ error: "Name and phone are required" }, { status: 400 });

    let referredByCustomerId: number | null = null;
    if (referred_by_code) {
      const { data: referrer } = await supabase.from("customers").select("id").eq("referral_code", referred_by_code).maybeSingle();
      referredByCustomerId = referrer?.id ?? null;
    }

    const referralCode = `RC${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const { data: customer, error } = await supabase
      .from("customers")
      .insert({
        name, phone, email: email || null, date_of_birth: date_of_birth || null, address: address || null,
        referral_code: referralCode, referred_by_customer_id: referredByCustomerId,
      })
      .select()
      .single();
    if (error) throw error;

    // Referral points are NOT awarded here — only once the referred customer
    // completes a real qualifying purchase (see checkReferralCompletion in
    // lib/customers.ts), so registration alone can't be used to farm points.

    return NextResponse.json({ success: true, customer }, { status: 201 });
  } catch (error) {
    console.error("Customer create error:", error);
    const message = error instanceof Error && error.message.includes("duplicate") ? "A customer with this phone number already exists" : "Failed to create customer";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
