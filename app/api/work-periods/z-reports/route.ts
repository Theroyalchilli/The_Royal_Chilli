import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageFinance } from "@/lib/permissions";
import type { ZReport } from "@/lib/z-report";

// GET — closed shifts, newest first, for Finance → Z Reports.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageFinance(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("work_periods")
    .select("id, opened_at, closed_at, close_note, z_report")
    .eq("status", "closed")
    .order("closed_at", { ascending: false })
    .limit(60);
  if (error) return NextResponse.json({ error: "Failed to load Z reports" }, { status: 500 });

  // Headline figures come from the close-time snapshot; shifts closed before
  // snapshots existed show them once opened (calculated live).
  const reports = (data ?? []).map((p) => {
    const z = p.z_report as ZReport | null;
    return {
      id: p.id,
      opened_at: p.opened_at,
      closed_at: p.closed_at,
      close_note: p.close_note,
      net_sales: z?.net_sales ?? null,
      difference: z?.cash.difference ?? null,
    };
  });
  return NextResponse.json({ reports });
}
