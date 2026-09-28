-- Attendance app: messages managers/admins write and send to staff (phone +
-- bell), now or at a set time. Scheduled ones are sent by the every-5-minute
-- check (/api/cron/shift-alerts).
CREATE TABLE IF NOT EXISTS staff_messages (
  id            SERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  audience      TEXT NOT NULL CHECK (audience IN ('everyone', 'today', 'managers', 'people')),
  staff_ids     INT[],                      -- audience = 'people'
  send_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at       TIMESTAMPTZ,                -- null = waiting to send
  cancelled_at  TIMESTAMPTZ,
  recipients    INT,                        -- how many got it in the bell
  phones        INT,                        -- how many phone notifications went
  created_by    INT REFERENCES staff(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_staff_messages_due ON staff_messages (send_at) WHERE sent_at IS NULL AND cancelled_at IS NULL;
ALTER TABLE staff_messages ENABLE ROW LEVEL SECURITY;
