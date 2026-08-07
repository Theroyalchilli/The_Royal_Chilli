import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageStaff } from "@/lib/permissions";
import { getOpenClockEvent, findTodaysShiftAndLateness } from "@/lib/attendance";
import { getGeofenceConfig, distanceMeters } from "@/lib/geofence";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { latitude, longitude } = body as { latitude?: number; longitude?: number };

    // A manager can clock a teammate in on their behalf (GPS trouble, phone
    // died, etc.) — that's a deliberate manager action, so it bypasses the
    // geofence check entirely rather than needing its own override UI.
    const onBehalfOfStaffId = body.staff_id as number | undefined;
    const isManagerOverride = !!onBehalfOfStaffId && onBehalfOfStaffId !== session.id;
    if (isManagerOverride && !canManageStaff(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const targetStaffId = isManagerOverride ? onBehalfOfStaffId : session.id;

    const existing = await getOpenClockEvent(targetStaffId);
    if (existing) {
      return NextResponse.json({ error: "Already clocked in" }, { status: 400 });
    }

    let distance: number | null = null;
    if (!isManagerOverride) {
      const geofence = await getGeofenceConfig();
      if (geofence.enabled && geofence.latitude != null && geofence.longitude != null) {
        if (latitude == null || longitude == null) {
          return NextResponse.json({ error: "Location is required to clock in. Please allow location access and try again." }, { status: 403 });
        }
        distance = Math.round(distanceMeters(latitude, longitude, geofence.latitude, geofence.longitude) * 10) / 10;
        if (distance > geofence.radiusMeters) {
          return NextResponse.json({
            error: `You're ${Math.round(distance)}m away — you need to be within ${geofence.radiusMeters}m of the restaurant to clock in. Ask a manager to clock you in if this is wrong.`,
          }, { status: 403 });
        }
      }
    }

    const now = new Date();
    const { shiftId, lateMinutes } = await findTodaysShiftAndLateness(targetStaffId, now);

    const { data, error } = await supabase
      .from("clock_events")
      .insert({
        staff_id: targetStaffId,
        shift_id: shiftId,
        clock_in: now.toISOString(),
        status: "open",
        late_minutes: lateMinutes,
        clock_in_latitude: isManagerOverride ? null : latitude ?? null,
        clock_in_longitude: isManagerOverride ? null : longitude ?? null,
        clock_in_distance_m: distance,
        clocked_in_by_manager: isManagerOverride ? session.id : null,
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, clockEvent: data }, { status: 201 });
  } catch (error) {
    console.error("Clock-in error:", error);
    return NextResponse.json({ error: "Failed to clock in" }, { status: 500 });
  }
}
