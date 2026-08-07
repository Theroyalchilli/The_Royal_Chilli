import supabase from "@/lib/supabase";

export type GeofenceConfig = {
  enabled: boolean;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
};

export async function getGeofenceConfig(): Promise<GeofenceConfig> {
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["geofence_enabled", "restaurant_latitude", "restaurant_longitude", "geofence_radius_meters"]);

  const map = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
  return {
    enabled: map.geofence_enabled === true,
    latitude: typeof map.restaurant_latitude === "number" ? map.restaurant_latitude : null,
    longitude: typeof map.restaurant_longitude === "number" ? map.restaurant_longitude : null,
    radiusMeters: typeof map.geofence_radius_meters === "number" ? map.geofence_radius_meters : 150,
  };
}

// Haversine — accurate enough for a single-site radius check; a restaurant's
// geofence doesn't need geodesic precision.
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
