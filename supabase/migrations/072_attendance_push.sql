-- Attendance app phone notifications (web push).
--
-- push_subscriptions: one row per phone/browser that tapped "Turn on
-- notifications". Removed automatically when the phone says it's gone.
-- shift_alerts_sent: each shift alert (15 min before, 5 min late, forgot to
-- clock out) goes once per shift — the 5-minute check records it here.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            SERIAL PRIMARY KEY,
  staff_id      INT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  endpoint      TEXT NOT NULL UNIQUE,
  p256dh        TEXT NOT NULL,
  auth          TEXT NOT NULL,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sent_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_staff ON push_subscriptions (staff_id);

CREATE TABLE IF NOT EXISTS shift_alerts_sent (
  id        SERIAL PRIMARY KEY,
  shift_id  INT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  kind      TEXT NOT NULL CHECK (kind IN ('before_start', 'not_clocked_in', 'forgot_clock_out')),
  sent_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shift_id, kind)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_alerts_sent  ENABLE ROW LEVEL SECURITY;
-- No anon policies: server-only (service role), like the rest of attendance.
