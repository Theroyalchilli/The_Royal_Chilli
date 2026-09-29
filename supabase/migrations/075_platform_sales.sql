-- Staff Hub: daily totals from the delivery-platform tablets (Just Eat, Uber
-- Eats, Deliveroo). They print their own tickets, so we only keep each day's
-- totals, typed in from the tablet's summary: orders, gross sales, commission.
-- business_id is ready for more than one restaurant later (1 = The Royal Chilli).
CREATE TABLE IF NOT EXISTS platform_sales (
  id           SERIAL PRIMARY KEY,
  business_id  INT NOT NULL DEFAULT 1,
  sales_date   DATE NOT NULL,              -- trading day
  platform     TEXT NOT NULL CHECK (platform IN ('just_eat', 'uber_eats', 'deliveroo')),
  orders       INT NOT NULL DEFAULT 0 CHECK (orders >= 0),
  sales        NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (sales >= 0),
  commission   NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (commission >= 0),
  entered_by   INT REFERENCES staff(id),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, sales_date, platform)
);
CREATE INDEX IF NOT EXISTS idx_platform_sales_date ON platform_sales (business_id, sales_date);
ALTER TABLE platform_sales ENABLE ROW LEVEL SECURITY;
