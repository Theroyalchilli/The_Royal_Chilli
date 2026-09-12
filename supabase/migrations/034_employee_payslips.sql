-- Per-employee ad-hoc payslips — sits alongside the existing period-based
-- Payroll (payroll_periods/payroll_entries), which stays the normal way to
-- run payroll for everyone at once. This is the "pick one employee, pick a
-- date range, generate a single payslip" flow requested for HR -> Payroll.

BEGIN;

CREATE TABLE IF NOT EXISTS employee_payslips (
  id            SERIAL PRIMARY KEY,
  staff_id      INT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,                 -- e.g. "September 2026 - Payslip #1"
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  hours_worked  NUMERIC NOT NULL DEFAULT 0,
  pay_rate      NUMERIC NOT NULL DEFAULT 0,
  total_amount  NUMERIC NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
  paid_at       TIMESTAMPTZ,                    -- set the instant status flips to 'paid'
  created_by    INT REFERENCES staff(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_payslip_period CHECK (period_end >= period_start)
);

CREATE INDEX idx_employee_payslips_staff ON employee_payslips (staff_id, created_at DESC);

ALTER TABLE employee_payslips ENABLE ROW LEVEL SECURITY;

COMMIT;
