import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import {
  ALL_ROLES,
  PERMISSION_KEYS,
  PERMISSION_LABELS,
  canManageStaff,
  getPermissionMatrix,
  refreshPermissionsCache,
} from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageStaff(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const matrix = await getPermissionMatrix();
  return NextResponse.json({ matrix, roles: ALL_ROLES, permissions: PERMISSION_KEYS, labels: PERMISSION_LABELS });
}

// Only owner/admin can edit permissions — a manager (who has manage_staff)
// must not be able to grant themselves finance/CRM access or lock out the admin.
export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || (session.role !== "owner" && session.role !== "admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, permission, granted } = await req.json();
    if (!ALL_ROLES.includes(role) || !PERMISSION_KEYS.includes(permission) || typeof granted !== "boolean") {
      return NextResponse.json({ error: "Invalid role, permission, or granted value" }, { status: 400 });
    }

    // Owner access can never be revoked from this UI — prevents an admin from
    // locking every owner out of the system by accident.
    if (role === "owner") {
      return NextResponse.json({ error: "Owner permissions cannot be changed" }, { status: 400 });
    }

    const { error } = await supabase
      .from("role_permissions")
      .upsert({ role, permission, granted }, { onConflict: "role,permission" });
    if (error) throw error;

    await refreshPermissionsCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Permissions update error:", error);
    return NextResponse.json({ error: "Failed to update permission" }, { status: 500 });
  }
}
