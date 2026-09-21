-- Displayed opening hours (footer, homepage badge, FAQ, schema.org) as a
-- per-day editable setting, replacing the hardcoded array in site-content.ts.
-- Seeded to match the current displayed value (every day, 9:00 AM – 1:00 AM)
-- so nothing visibly changes until staff actually edit it.
--
-- NOTE: this only covers DISPLAYED hours. The separate, structured hours in
-- lib/hours.ts that actually gate live ordering and "Schedule for later"
-- slots are deliberately NOT wired to this yet — that's its own follow-up
-- given the correctness stakes of checkout logic.
INSERT INTO app_settings (key, value) VALUES
  ('opening_hours', '[
    {"day": "Monday", "open": "09:00", "close": "01:00"},
    {"day": "Tuesday", "open": "09:00", "close": "01:00"},
    {"day": "Wednesday", "open": "09:00", "close": "01:00"},
    {"day": "Thursday", "open": "09:00", "close": "01:00"},
    {"day": "Friday", "open": "09:00", "close": "01:00"},
    {"day": "Saturday", "open": "09:00", "close": "01:00"},
    {"day": "Sunday", "open": "09:00", "close": "01:00"}
  ]'::jsonb)
ON CONFLICT (key) DO NOTHING;
