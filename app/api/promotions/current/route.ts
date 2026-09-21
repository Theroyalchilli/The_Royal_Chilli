import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageStaff } from "@/lib/permissions";

// Single-active-promotion model: staff manage one promotion slot, not a
// list. GET/PUT always operate on the most recently created row.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageStaff(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data } = await supabase
    .from("promotions")
    .select("id, title, description, link_url, active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return NextResponse.json({ promotion: data });
}

export async function PUT(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageStaff(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { title, description, link_url, active } = await req.json();
  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("promotions")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const fields = { title: title.trim(), description: description?.trim() || null, link_url: link_url?.trim() || null, active: !!active };

  if (existing) {
    const { error } = await supabase.from("promotions").update(fields).eq("id", existing.id);
    if (error) return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  } else {
    const { error } = await supabase.from("promotions").insert(fields);
    if (error) return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
