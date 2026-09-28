import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { joinMemberAtTill } from "@/lib/customers";
import { linkMemberToOrders } from "@/lib/member-link";
import { isValidEmail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Till "🎁 Member" panel on the payment screen. Any signed-in staff member
// can use it — it's part of taking payment, like applying a voucher code.

// GET ?q= — find members by phone (any 4+ digits of it) or email.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (q.length < 3) return NextResponse.json({ members: [] });

  const digits = q.replace(/\D/g, "");
  let query = supabase.from("customers").select("id, name, phone, email, loyalty_points").limit(6);
  if (q.includes("@")) query = query.ilike("email", `%${q.replace(/[%_]/g, "")}%`);
  else if (digits.length >= 4) query = query.ilike("phone", `%${digits}%`);
  else query = query.ilike("name", `%${q.replace(/[%_]/g, "")}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Search failed" }, { status: 500 });
  return NextResponse.json({ members: data ?? [] });
}

// POST { name, phone, email?, marketing_consent?, order_ids? } — join the
// Rewards Club at the till (full welcome: sign-up points + 20% voucher for
// next visit) and link them to this bill.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json();
  const name = String(b.name || "").trim();
  const phone = String(b.phone || "").trim();
  const email = String(b.email || "").trim();
  if (!name || !phone) return NextResponse.json({ error: "Name and phone are required" }, { status: 400 });
  if (phone.replace(/\D/g, "").length < 10) return NextResponse.json({ error: "Enter a full phone number" }, { status: 400 });
  if (email && !isValidEmail(email)) return NextResponse.json({ error: "That email doesn't look right" }, { status: 400 });

  const joined = await joinMemberAtTill({ name, phone, email: email || null, marketingConsent: b.marketing_consent === true });
  if (!joined.ok) return NextResponse.json({ error: joined.error }, { status: 400 });

  const orderIds = Array.isArray(b.order_ids) ? b.order_ids.map(Number).filter(Boolean) : [];
  if (orderIds.length) {
    const linked = await linkMemberToOrders(joined.customerId, orderIds);
    if (!linked.ok) return NextResponse.json({ error: linked.error }, { status: 409 });
  }

  const { data: member } = await supabase
    .from("customers")
    .select("id, name, phone, email, loyalty_points")
    .eq("id", joined.customerId)
    .single();
  return NextResponse.json({ member, already_member: joined.alreadyMember }, { status: 201 });
}
