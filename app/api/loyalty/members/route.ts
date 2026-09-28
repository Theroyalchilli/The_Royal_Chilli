import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { joinMemberAtTill } from "@/lib/customers";
import { linkMemberToOrders } from "@/lib/member-link";
import { isValidEmail } from "@/lib/utils";
import { normalizeUkMobile } from "@/lib/phone";

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
  const mobile = normalizeUkMobile(q);
  let query = supabase.from("customers").select("id, name, phone, email, loyalty_points").is("merged_into", null).limit(6);
  if (q.includes("@")) query = query.ilike("email", `%${q.replace(/[%_]/g, "")}%`);
  else if (mobile) query = query.eq("phone", mobile); // "+44 7700 900123" finds 07700900123
  else if (digits.length >= 4) query = query.ilike("phone", `%${digits}%`);
  else query = query.ilike("name", `%${q.replace(/[%_]/g, "")}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Search failed" }, { status: 500 });
  return NextResponse.json({ members: data ?? [] });
}

// POST { name, phone, email, marketing_consent?, order_ids?, use_customer_id? }
// — join the Rewards Club at the till (full welcome: sign-up points + 20%
// voucher for next visit) and link them to this bill. If the mobile and email
// belong to two different people → 409 with both, and the till asks staff
// which one (sent back as use_customer_id).
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json();
  const name = String(b.name || "").trim();
  const phone = String(b.phone || "").trim();
  const email = String(b.email || "").trim();
  if (!name || !phone || !email) return NextResponse.json({ error: "Name, mobile and email are required" }, { status: 400 });
  if (!normalizeUkMobile(phone)) return NextResponse.json({ error: "Enter a UK mobile number (starts with 07)" }, { status: 400 });
  if (!isValidEmail(email)) return NextResponse.json({ error: "That email doesn't look right" }, { status: 400 });

  const joined = await joinMemberAtTill({
    name,
    phone,
    email,
    marketingConsent: b.marketing_consent === true,
    useCustomerId: b.use_customer_id ? Number(b.use_customer_id) : null,
  });
  if (!joined.ok) {
    return NextResponse.json({ error: joined.error, conflict: joined.conflict ?? null }, { status: joined.conflict ? 409 : 400 });
  }

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
