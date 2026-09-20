import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getCustomerSessionFromRequest } from "@/lib/customer-auth";
import { isValidUkMobile } from "@/lib/utils";
import { CUSTOMER_SAFE_FIELDS } from "@/lib/customers";

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCustomerSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, phone } = await req.json();
    const updates: Record<string, unknown> = {};

    if (name !== undefined) {
      if (!String(name).trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
      updates.name = String(name).trim();
    }
    if (phone !== undefined) {
      const cleanPhone = phone ? String(phone).trim() : null;
      if (cleanPhone && !isValidUkMobile(cleanPhone)) {
        return NextResponse.json({ error: "Please enter a valid UK mobile number (starts with 07, 11 digits)" }, { status: 400 });
      }
      updates.phone = cleanPhone;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("customers")
      .update(updates)
      .eq("id", session.id)
      .select(CUSTOMER_SAFE_FIELDS)
      .single();

    if (error) {
      // Postgres unique_violation — this phone is already on a different account.
      if ((error as { code?: string }).code === "23505") {
        return NextResponse.json({ error: "That mobile number is already linked to another account" }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, customer: data });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
