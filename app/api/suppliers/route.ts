import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageInventory } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageInventory(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const activeParam = searchParams.get("active") ?? "1";

  let query = supabase.from("suppliers").select("*").order("name");
  if (activeParam !== "all") query = query.eq("active", Number(activeParam));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to fetch suppliers" }, { status: 500 });
  return NextResponse.json({ suppliers: data });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageInventory(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { name, contact_name, phone, email, address, notes } = await req.json();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const { data, error } = await supabase
      .from("suppliers")
      .insert({ name, contact_name: contact_name || null, phone: phone || null, email: email || null, address: address || null, notes: notes || null })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, supplier: data }, { status: 201 });
  } catch (error) {
    console.error("Supplier create error:", error);
    return NextResponse.json({ error: "Failed to create supplier" }, { status: 500 });
  }
}
