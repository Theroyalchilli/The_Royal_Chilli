import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getCustomerSessionFromRequest } from "@/lib/customer-auth";

// Every write here is scoped with .eq("customer_id", session.id) as well as
// .eq("id", addressId) — never trust the id alone, or one customer could
// edit/delete another's saved address by guessing an id.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getCustomerSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    // "Set default": clear every other address's flag first, then set this one.
    await supabase.from("customer_addresses").update({ is_default: false }).eq("customer_id", session.id);
    const { error } = await supabase
      .from("customer_addresses")
      .update({ is_default: true })
      .eq("id", id)
      .eq("customer_id", session.id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Set default address error:", error);
    return NextResponse.json({ error: "Failed to update address" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getCustomerSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const { data: removed, error } = await supabase
      .from("customer_addresses")
      .delete()
      .eq("id", id)
      .eq("customer_id", session.id)
      .select("is_default")
      .maybeSingle();
    if (error) throw error;

    // If the default was just removed, promote whichever address is left.
    if (removed?.is_default) {
      const { data: next } = await supabase
        .from("customer_addresses")
        .select("id")
        .eq("customer_id", session.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (next) await supabase.from("customer_addresses").update({ is_default: true }).eq("id", next.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete address error:", error);
    return NextResponse.json({ error: "Failed to delete address" }, { status: 500 });
  }
}
