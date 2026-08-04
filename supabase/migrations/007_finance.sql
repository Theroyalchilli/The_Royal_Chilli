-- Module 7: Finance — expenses, supplier payments, and reports built on existing data.

CREATE TABLE IF NOT EXISTS expenses (
  id                SERIAL PRIMARY KEY,
  category          TEXT NOT NULL CHECK (category IN ('rent', 'utilities', 'marketing', 'equipment', 'professional_fees', 'other')),
  description       TEXT NOT NULL,
  amount            NUMERIC(10,2) NOT NULL,
  vat_applicable    INT NOT NULL DEFAULT 1, -- most non-food expenses carry VAT; raw ingredients usually don't (zero-rated)
  expense_date      DATE DEFAULT CURRENT_DATE,
  receipt_reference TEXT,
  recorded_by       INT REFERENCES staff(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id                 SERIAL PRIMARY KEY,
  supplier_id        INT REFERENCES suppliers(id) NOT NULL,
  purchase_order_id  INT REFERENCES purchase_orders(id),
  amount             NUMERIC(10,2) NOT NULL,
  method             TEXT,
  paid_at            TIMESTAMPTZ DEFAULT NOW(),
  recorded_by        INT REFERENCES staff(id),
  notes              TEXT
);

ALTER TABLE expenses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_payments  ENABLE ROW LEVEL SECURITY;
-- No anon policies: server-only, same as the rest of the platform.
