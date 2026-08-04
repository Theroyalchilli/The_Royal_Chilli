import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageStaff } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageStaff(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: groups, error } = await supabase.from("modifier_groups").select("*").order("id");
  if (error) return NextResponse.json({ error: "Failed to fetch modifier groups" }, { status: 500 });

  const { data: options } = await supabase.from("modifier_options").select("*").order("display_order");
  const grouped = (groups || []).map((g) => ({
    ...g,
    options: (options || []).filter((o) => o.group_id === g.id),
  }));

  return NextResponse.json({ groups: grouped });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageStaff(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { name, selection_type, min_select, max_select, options } = await req.json();
    if (!name || !Array.isArray(options) || options.length === 0) {
      return NextResponse.json({ error: "name and at least one option are required" }, { status: 400 });
    }

    const { data: group, error } = await supabase
      .from("modifier_groups")
      .insert({ name, selection_type: selection_type === "multiple" ? "multiple" : "single", min_select: min_select || 0, max_select: max_select || null })
      .select()
      .single();
    if (error) throw error;

    const rows = options.map((o: { name: string; price_delta?: number }, i: number) => ({
      group_id: group.id, name: o.name, price_delta: o.price_delta || 0, display_order: i,
    }));
    const { error: optErr } = await supabase.from("modifier_options").insert(rows);
    if (optErr) throw optErr;

    return NextResponse.json({ success: true, group }, { status: 201 });
  } catch (error) {
    console.error("Modifier group create error:", error);
    return NextResponse.json({ error: "Failed to create modifier group" }, { status: 500 });
  }
}
