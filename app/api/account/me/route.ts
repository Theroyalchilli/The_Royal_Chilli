import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getCustomerSessionFromRequest } from "@/lib/customer-auth";

export async function GET(req: NextRequest) {
  const session = await getCustomerSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // current details (the session holds what they were at login) — the
  // checkout pre-fills from these
  const { data } = await supabase.from("customers").select("name, email, phone").eq("id", session.id).maybeSingle();
  return NextResponse.json({ customer: { ...session, ...(data ?? {}) } });
}
