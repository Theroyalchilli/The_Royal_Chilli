-- Attendance rebuild — Phase 1 of moving clock-in/out to a dedicated app
-- (royal-chilli-attendance) that shares this Supabase database.
--
-- Design ported from the standalone FastAPI attendance-system, adapted to this
-- codebase's conventions: integer SERIAL ids, FK to `staff`, TEXT + CHECK
-- instead of Postgres ENUMs, no multi-tenancy (single restaurant), app sets
-- updated_at (no triggers). Derived numbers are whole SECONDS — payroll-safe,
-- no float drift — and are always recomputed by the time engine, never trusted
-- from a client.
--
-- This migration is ADDITIVE. clock_events / breaks / shifts stay in place and
-- keep working until Phase 7, which migrates their rows into `attendance` and
-- repoints Payroll. Nothing here changes current behaviour.

BEGIN;

-- ---------------------------------------------------------------------------
-- staff: personal rota defaults + kiosk PIN lockout state
-- (staff.pin_hash, pay_rate, employment_type already exist)
-- ---------------------------------------------------------------------------
ALTER TABLE staff ADD COLUMN IF NOT EXISTS rota_start          TIME;                     -- wall-clock, workplace tz
ALTER TABLE staff ADD COLUMN IF NOT EXISTS rota_end            TIME;                     -- may be < rota_start for overnight
ALTER TABLE staff ADD COLUMN IF NOT EXISTS rota_working_days   SMALLINT[] DEFAULT '{1,2,3,4,5}';  -- ISO: 1=Mon .. 7=Sun
ALTER TABLE staff ADD COLUMN IF NOT EXISTS rota_break_minutes  INT DEFAULT 0;            -- unpaid break deducted per shift
ALTER TABLE staff ADD COLUMN IF NOT EXISTS rota_grace_minutes  INT DEFAULT 0;            -- lateness allowance
ALTER TABLE staff ADD COLUMN IF NOT EXISTS pin_fail_count      INT DEFAULT 0;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS pin_locked_until    TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- attendance — one row per shift (split/overnight handled by the engine)
-- ---------------------------------------------------------------------------
CREATE TABLE attendance (
  id                      SERIAL PRIMARY KEY,
  staff_id                INT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  work_date               DATE NOT NULL,                 -- logical shift day (workplace tz)
  shift_id                INT REFERENCES shifts(id) ON DELETE SET NULL,   -- matched rota row, if any

  scheduled_start         TIMESTAMPTZ,                   -- snapshot from the rota at clock-in
  scheduled_end           TIMESTAMPTZ,

  clock_in                TIMESTAMPTZ,
  clock_out               TIMESTAMPTZ,
  clock_in_method         TEXT CHECK (clock_in_method  IN ('kiosk','web','qr','manual')),
  clock_out_method        TEXT CHECK (clock_out_method IN ('kiosk','web','qr','manual')),
  clock_in_photo          TEXT,                          -- object path in the attendance-photos bucket
  clock_out_photo         TEXT,
  clock_in_lat            NUMERIC(9,6),                  -- kept for audit; kiosk punches have none
  clock_in_lng            NUMERIC(9,6),
  clock_out_lat           NUMERIC(9,6),
  clock_out_lng           NUMERIC(9,6),

  -- Offline-queue idempotency: the kiosk generates a uuid per punch and replays
  -- queued punches; a duplicate insert is rejected by the unique index.
  clock_in_client_uuid    TEXT UNIQUE,
  clock_out_client_uuid   TEXT UNIQUE,

  -- Manager inputs to the calculation — applied by the engine, shown separately,
  -- never a silent rewrite of the raw punch timestamps.
  break_override_minutes  INT,                           -- NULL = use the rota break
  adjustment_seconds      INT NOT NULL DEFAULT 0,        -- explicit +/- by a manager

  -- Derived (whole seconds) — recomputed by the time engine on every write.
  break_seconds           INT NOT NULL DEFAULT 0,
  net_work_seconds        INT NOT NULL DEFAULT 0,
  regular_seconds         INT NOT NULL DEFAULT 0,
  overtime_seconds        INT NOT NULL DEFAULT 0,
  late_seconds            INT NOT NULL DEFAULT 0,
  early_departure_seconds INT NOT NULL DEFAULT 0,
  is_overnight            BOOLEAN NOT NULL DEFAULT FALSE,

  status                  TEXT NOT NULL DEFAULT 'not_started'
                            CHECK (status IN ('not_started','clocked_in','clocked_out','absent','leave','holiday')),
  photo_missing           BOOLEAN NOT NULL DEFAULT FALSE, -- camera unavailable at a punch

  approval_status         TEXT NOT NULL DEFAULT 'auto'
                            CHECK (approval_status IN ('auto','pending','approved','rejected')),
  approved_by             INT REFERENCES staff(id) ON DELETE SET NULL,
  approved_at             TIMESTAMPTZ,
  entered_by              INT REFERENCES staff(id) ON DELETE SET NULL,  -- manual entry / manager clocked them
  notes                   TEXT,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_att_out_after_in
    CHECK (clock_out IS NULL OR clock_in IS NULL OR clock_out > clock_in)
);

-- Cannot clock in twice: at most one open shift per employee.
CREATE UNIQUE INDEX uniq_att_open_shift
  ON attendance (staff_id)
  WHERE clock_in IS NOT NULL AND clock_out IS NULL;

CREATE INDEX idx_att_staff_date ON attendance (staff_id, work_date);
CREATE INDEX idx_att_date       ON attendance (work_date);
CREATE INDEX idx_att_approval   ON attendance (approval_status) WHERE approval_status = 'pending';

-- ---------------------------------------------------------------------------
-- attendance_corrections — employee-requested changes, original never overwritten
-- ---------------------------------------------------------------------------
CREATE TABLE attendance_corrections (
  id                SERIAL PRIMARY KEY,
  attendance_id     INT REFERENCES attendance(id) ON DELETE SET NULL,
  staff_id          INT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  original_snapshot JSONB NOT NULL,                      -- the attendance row at request time
  requested_change  JSONB NOT NULL,                      -- { field: new_value, ... }
  reason            TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','rejected','info_requested')),
  reviewed_by       INT REFERENCES staff(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  review_note       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_att_corr_status ON attendance_corrections (status);

-- ---------------------------------------------------------------------------
-- timesheets — per employee + week; approve then lock for payroll
-- ---------------------------------------------------------------------------
CREATE TABLE timesheets (
  id            SERIAL PRIMARY KEY,
  staff_id      INT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','submitted','approved','rejected','locked')),
  totals        JSONB,                                   -- { net_seconds, regular_seconds, overtime_seconds, break_seconds, days_worked }
  submitted_at  TIMESTAMPTZ,
  approved_by   INT REFERENCES staff(id) ON DELETE SET NULL,
  approved_at   TIMESTAMPTZ,
  locked        BOOLEAN NOT NULL DEFAULT FALSE,          -- Payroll reads only locked timesheets
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (staff_id, period_start, period_end)
);
CREATE INDEX idx_timesheets_period ON timesheets (period_start, period_end);

-- ---------------------------------------------------------------------------
-- Settings (reusing app_settings; value is JSONB)
-- ---------------------------------------------------------------------------
INSERT INTO app_settings (key, value) VALUES
  ('attendance_timezone',                 '"Europe/London"'),
  ('attendance_overtime_enabled',         'false'),
  ('attendance_overtime_daily_minutes',   '0'),
  ('attendance_overtime_multiplier',      '1.5'),
  ('attendance_rounding_minutes',         '0'),
  ('attendance_default_grace_minutes',    '5'),
  ('attendance_photo_retention_days',     '60'),
  ('attendance_kiosk_pin_max_attempts',   '5'),
  ('attendance_kiosk_pin_lockout_minutes','5'),
  ('attendance_missing_clockout_hours',   '16')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Private Storage bucket for kiosk clock photos (purged on retention by a job)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance-photos', 'attendance-photos', false)
ON CONFLICT (id) DO NOTHING;

COMMIT;
