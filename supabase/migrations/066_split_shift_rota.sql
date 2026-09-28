-- Split shifts: a staff member's usual rota can have a second time slot on
-- the same day (e.g. 06:00–10:00 and 17:00–00:00). Used by the attendance
-- app's "Fill from defaults" and as the fallback schedule at clock-in.
-- Both NULL = single-slot pattern, same as before.
ALTER TABLE staff ADD COLUMN IF NOT EXISTS rota_start_2 TIME;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS rota_end_2   TIME;
