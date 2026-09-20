import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getCustomerSessionFromRequest } from "@/lib/customer-auth";

export async function GET(req: NextRequest) {
  const session = await getCustomerSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: addresses } = await supabase
    .from("customer_addresses")
    .select("*")
    .eq("customer_id", session.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  return NextResponse.json({ addresses: addresses || [] });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCustomerSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { label, line, postcode } = await req.json();
    if (!String(line || "").trim()) {
      return NextResponse.json({ error: "Please enter a full address" }, { status: 400 });
    }

    // First address for this customer becomes the default automatically.
    const { count } = await supabase
      .from("customer_addresses")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", session.id);

    const { data, error } = await supabase
      .from("customer_addresses")
      .insert({
        customer_id: session.id,
        label: String(label || "Address").trim() || "Address",
        line: String(line).trim(),
        postcode: postcode ? String(postcode).trim() : null,
        is_default: (count ?? 0) === 0,
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, address: data }, { status: 201 });
  } catch (error) {
    console.error("Add address error:", error);
    return NextResponse.json({ error: "Failed to save address" }, { status: 500 });
  }
}
