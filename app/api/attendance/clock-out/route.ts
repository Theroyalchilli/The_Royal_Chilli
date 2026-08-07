import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { getOpenClockEvent, getOpenBreak } from "@/lib/attendance";
import { getGeofenceConfig, distanceMeters } from "@/lib/geofence";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const open = await getOpenClockEvent(session.id);
    if (!open) {
      return NextResponse.json({ error: "You're not clocked in" }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Auto-close a forgotten open break so clock-out always leaves a clean record.
    const openBreak = await getOpenBreak(open.id);
    if (openBreak) {
      await supabase.from("breaks").update({ break_end: now }).eq("id", openBreak.id);
    }

    // Location is recorded for the record if geofencing is on, but clock-out
    // is never blocked by it — you should always be able to end your shift.
    const body = await req.json().catch(() => ({}));
    const { latitude, longitude } = body as { latitude?: number; longitude?: number };
    let distance: number | null = null;
    if (latitude != null && longitude != null) {
      const geofence = await getGeofenceConfig();
      if (geofence.enabled && geofence.latitude != null && geofence.longitude != null) {
        distance = Math.round(distanceMeters(latitude, longitude, geofence.latitude, geofence.longitude) * 10) / 10;
      }
    }

    const { data, error } = await supabase
      .from("clock_events")
      .update({
        clock_out: now, status: "closed",
        clock_out_latitude: latitude ?? null, clock_out_longitude: longitude ?? null, clock_out_distance_m: distance,
      })
      .eq("id", open.id)
      .select()
      .single();
    if (error) throw error;

    if (open.shift_id) {
      await supabase.from("shifts").update({ status: "completed" }).eq("id", open.shift_id);
    }

    return NextResponse.json({ success: true, clockEvent: data });
  } catch (error) {
    console.error("Clock-out error:", error);
    return NextResponse.json({ error: "Failed to clock out" }, { status: 500 });
  }
}
