-- 083 — Royal Chilli's settings: catch its own copy up with the shared list.
--
-- Step 4, stage 2a: the till, website, Settings page and the attendance app
-- now read each business's own settings (business_settings) instead of the
-- one shared list (app_settings). Migration 080 copied The Royal Chilli's
-- values on 2026-09-29, but anything changed since then (opening hours, busy
-- mode, card reader, …) was saved only to app_settings — so copy them again,
-- this time overwriting, because app_settings has been the live one.
--
-- Run it just before the new code goes live. Safe to re-run.
-- (The print-station key stays in app_settings — it's a device secret.)

BEGIN;

INSERT INTO business_settings (business_id, key, value, updated_at)
SELECT 1, key, value, COALESCE(updated_at, now())
FROM app_settings
WHERE key NOT LIKE 'print_station_key_hash%'
ON CONFLICT (business_id, key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

COMMIT;
