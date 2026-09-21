import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageStaff } from "@/lib/permissions";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageStaff(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const updates = await req.json();
  const allowed: Record<string, unknown> = {};
  if (updates.blurb !== undefined) allowed.blurb = updates.blurb || null;
  if (updates.position !== undefined) allowed.position = updates.position;

  const { error } = await supabase.from("featured_dishes").update(allowed).eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageStaff(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { error } = await supabase.from("featured_dishes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to remove" }, { status: 500 });
  return NextResponse.json({ success: true });
}
