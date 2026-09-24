-- Free-text note staff can add when closing the till (e.g. "Monday", "quiet
-- night, boiler issue") — shown on the Z-report style end-of-day printout.
ALTER TABLE work_periods ADD COLUMN IF NOT EXISTS close_note TEXT;
