-- Attendance app notifications panel + settings.
--
-- notifications.title       a proper title per notification (older rows keep
--                           NULL; the app falls back to a title per type)
-- notifications.message_id  the staff message it came from ("Read by 6 of 9")
-- notifications.deleted_at  swiped away by the person — hidden for them, but
--                           kept so read receipts stay right
-- notification_prefs        which alerts buzz each person's phone. Manager
--                           messages and shift reminders are always on and
--                           have no switch; everything stays in the bell.

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message_id INT REFERENCES staff_messages(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_notifications_message ON notifications (message_id) WHERE message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS notification_prefs (
  staff_id       INT PRIMARY KEY REFERENCES staff(id) ON DELETE CASCADE,
  rota           BOOLEAN NOT NULL DEFAULT TRUE,  -- rota ready, shift added/changed/removed
  requests       BOOLEAN NOT NULL DEFAULT TRUE,  -- my leave / corrections answered
  team_late      BOOLEAN NOT NULL DEFAULT TRUE,  -- managers: staff not clocked in, forgotten clock-outs
  team_requests  BOOLEAN NOT NULL DEFAULT TRUE,  -- managers: new leave / correction requests
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE notification_prefs ENABLE ROW LEVEL SECURITY;
