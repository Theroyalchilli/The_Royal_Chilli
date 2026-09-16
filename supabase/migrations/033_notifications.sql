-- In-app notifications for the attendance app (royal-chilli-attendance).
-- Not used by the POS. Written by the attendance app when a correction is
-- submitted / reviewed and by the daily missed-clock-out job.

CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  staff_id    INT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,           -- correction_submitted | correction_reviewed | missed_clockout
  message     TEXT NOT NULL,
  link        TEXT,                    -- in-app path, e.g. /admin/corrections
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_staff_unread
  ON notifications (staff_id, read_at, created_at DESC);
