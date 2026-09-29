import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { staffIdsAt } from "@/lib/business";

// GET — active staff names, for the till's "Discount given by" picker. Any
// logged-in staff member (the till runs on one shared login); names only.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase.from("staff").select("id, name").eq("active", 1).in("id", await staffIdsAt(session.businessId)).order("name");
  if (error) return NextResponse.json({ error: "Failed to load staff" }, { status: 500 });
  return NextResponse.json({ staff: data ?? [] });
}
