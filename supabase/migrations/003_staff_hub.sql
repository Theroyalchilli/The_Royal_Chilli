-- Module 4: Staff Hub — employees, attendance, rota, leave, payroll, audit log, settings.
-- Incremental migration (the live DB already has real menu/order data — never re-run schema.sql wholesale).

-- Extend staff into full employee profiles + the full role list from the spec.
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check CHECK (role IN (
  'owner','admin','manager','supervisor','cashier','waiter','chef','kitchen',
  'driver','inventory_manager','accountant','employee'
));

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS employee_number TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS hire_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS employment_type TEXT CHECK (employment_type IN ('hourly', 'salaried')) DEFAULT 'hourly',
  ADD COLUMN IF NOT EXISTS pay_rate NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pay_frequency TEXT CHECK (pay_frequency IN ('weekly', 'monthly')) DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Weekly rota / shift assignments.
CREATE TABLE IF NOT EXISTS shifts (
  id          SERIAL PRIMARY KEY,
  staff_id    INT REFERENCES staff(id) NOT NULL,
  shift_date  DATE NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  position    TEXT,
  status      TEXT NOT NULL CHECK (status IN ('scheduled', 'completed', 'missed', 'cancelled')) DEFAULT 'scheduled',
  notes       TEXT,
  created_by  INT REFERENCES staff(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Clock in/out. Full timestamps (not just TIME) so overnight shifts spanning midnight work naturally.
CREATE TABLE IF NOT EXISTS clock_events (
  id                  SERIAL PRIMARY KEY,
  staff_id            INT REFERENCES staff(id) NOT NULL,
  shift_id            INT REFERENCES shifts(id),
  clock_in            TIMESTAMPTZ NOT NULL,
  clock_out           TIMESTAMPTZ,
  status              TEXT NOT NULL CHECK (status IN ('open', 'closed')) DEFAULT 'open',
  late_minutes        INT DEFAULT 0,
  notes               TEXT,
  correction_status   TEXT NOT NULL CHECK (correction_status IN ('none', 'pending', 'approved', 'rejected')) DEFAULT 'none',
  correction_reason   TEXT,
  requested_clock_in  TIMESTAMPTZ,
  requested_clock_out TIMESTAMPTZ,
  approved_by         INT REFERENCES staff(id),
  approved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS breaks (
  id              SERIAL PRIMARY KEY,
  clock_event_id  INT REFERENCES clock_events(id) ON DELETE CASCADE NOT NULL,
  break_start     TIMESTAMPTZ NOT NULL,
  break_end       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id          SERIAL PRIMARY KEY,
  staff_id    INT REFERENCES staff(id) NOT NULL,
  leave_type  TEXT NOT NULL CHECK (leave_type IN ('holiday', 'sick', 'unpaid', 'other')),
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  reason      TEXT,
  status      TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  decided_by  INT REFERENCES staff(id),
  decided_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_periods (
  id           SERIAL PRIMARY KEY,
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('open', 'processing', 'closed')) DEFAULT 'open',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (period_start, period_end)
);

-- Simplified formula per owner's decision: gross_pay = hours_worked * pay_rate + bonuses + tips - deductions.
-- No overtime multiplier. holiday_pay is entered manually (no auto rolled-up % calculation for now).
CREATE TABLE IF NOT EXISTS payroll_entries (
  id                SERIAL PRIMARY KEY,
  payroll_period_id INT REFERENCES payroll_periods(id) NOT NULL,
  staff_id          INT REFERENCES staff(id) NOT NULL,
  hours_worked      NUMERIC(6,2) DEFAULT 0,
  pay_rate          NUMERIC(10,2) DEFAULT 0,
  base_pay          NUMERIC(10,2) DEFAULT 0,
  bonuses           NUMERIC(10,2) DEFAULT 0,
  tips              NUMERIC(10,2) DEFAULT 0,
  deductions        NUMERIC(10,2) DEFAULT 0,
  holiday_pay       NUMERIC(10,2) DEFAULT 0,
  gross_pay         NUMERIC(10,2) DEFAULT 0,
  paid_amount       NUMERIC(10,2) DEFAULT 0,
  status            TEXT NOT NULL CHECK (status IN ('pending', 'partially_paid', 'paid')) DEFAULT 'pending',
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (payroll_period_id, staff_id)
);

CREATE TABLE IF NOT EXISTS payroll_payments (
  id                SERIAL PRIMARY KEY,
  payroll_entry_id  INT REFERENCES payroll_entries(id) NOT NULL,
  amount            NUMERIC(10,2) NOT NULL,
  method            TEXT,
  paid_at           TIMESTAMPTZ DEFAULT NOW(),
  recorded_by       INT REFERENCES staff(id),
  notes             TEXT
);

-- Platform-wide audit log (shared across every module per the "one platform" requirement).
CREATE TABLE IF NOT EXISTS audit_logs (
  id          SERIAL PRIMARY KEY,
  staff_id    INT REFERENCES staff(id),
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   INT,
  changes     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_settings (key, value) VALUES
  ('company_name', '"The Royal Chilli"'),
  ('currency', '"GBP"'),
  ('week_start_day', '"Monday"'),
  ('overtime_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- RLS: all Staff Hub tables are internal-only. No anon policies anywhere —
-- only the server (service_role) ever reads/writes this data.
ALTER TABLE shifts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE clock_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE breaks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_periods  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings     ENABLE ROW LEVEL SECURITY;

-- Backfill employee_number for the 4 existing seeded staff so the UNIQUE constraint is satisfiable going forward.
UPDATE staff SET employee_number = 'RC-EMP-' || LPAD(id::text, 4, '0') WHERE employee_number IS NULL;
