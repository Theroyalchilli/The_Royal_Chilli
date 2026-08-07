-- Geofenced clock-in/out. Location is captured on both, but only clock-in is
-- ever blocked by it (clock-out always succeeds — you should never be stuck
-- "clocked in" because you left the building or your GPS glitched).
-- Config lives in app_settings: geofence_enabled, restaurant_latitude,
-- restaurant_longitude, geofence_radius_meters. Off by default so this never
-- silently changes behavior until an owner/admin turns it on in Settings.

ALTER TABLE clock_events ADD COLUMN IF NOT EXISTS clock_in_latitude   NUMERIC(9,6);
ALTER TABLE clock_events ADD COLUMN IF NOT EXISTS clock_in_longitude  NUMERIC(9,6);
ALTER TABLE clock_events ADD COLUMN IF NOT EXISTS clock_in_distance_m NUMERIC(9,1);
ALTER TABLE clock_events ADD COLUMN IF NOT EXISTS clock_out_latitude   NUMERIC(9,6);
ALTER TABLE clock_events ADD COLUMN IF NOT EXISTS clock_out_longitude  NUMERIC(9,6);
ALTER TABLE clock_events ADD COLUMN IF NOT EXISTS clock_out_distance_m NUMERIC(9,1);
-- Set when a manager clocks someone in on their behalf (GPS trouble, phone
-- died, etc.) — bypasses the geofence check, and is visible on the record
-- so it's clear the location fields don't apply.
ALTER TABLE clock_events ADD COLUMN IF NOT EXISTS clocked_in_by_manager INT REFERENCES staff(id);
