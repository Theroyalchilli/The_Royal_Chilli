-- Till-specific cash removed mid-shift (paying a delivery driver, petty cash
-- for supplies) — deliberately separate from the formal `expenses` table,
-- which is accounting-categorized bookkeeping with no link to a specific
-- shift. This exists purely so EOD's Expected Cash can subtract it back out.
CREATE TABLE IF NOT EXISTS cash_paid_outs (
  id             SERIAL PRIMARY KEY,
  work_period_id INT NOT NULL REFERENCES work_periods(id),
  amount         NUMERIC(10,2) NOT NULL,
  reason         TEXT NOT NULL,
  staff_id       INT REFERENCES staff(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_paid_outs_period ON cash_paid_outs (work_period_id);
