import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("table_requests")
    .select("id, type, status, created_at, restaurant_tables(table_number)")
    .eq("status", "pending")
    .order("created_at");
  if (error) {
    return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 });
  }

  const flat = (data || []).map((r) => {
    const { restaurant_tables: rt, ...rest } = r as typeof r & {
      restaurant_tables: { table_number: string } | null;
    };
    return { ...rest, table_number: rt?.table_number ?? null };
  });

  return NextResponse.json({ requests: flat });
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("table_requests")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Failed to resolve request" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
