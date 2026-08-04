-- Online ordering gap: per-zone delivery pricing, replacing the flat £3.50 fee.
-- Zones are matched by UK postcode outward code (e.g. "TW3" from "TW3 1PA").
CREATE TABLE IF NOT EXISTS delivery_zones (
  id                SERIAL PRIMARY KEY,
  name              TEXT NOT NULL,
  postcode_prefixes TEXT[] NOT NULL DEFAULT '{}',
  fee               NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_order         NUMERIC(10,2) NOT NULL DEFAULT 0,
  active            INT NOT NULL DEFAULT 1,
  display_order     INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_postcode TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_zone_id INT REFERENCES delivery_zones(id);

ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
-- No anon policies: zones are read via the server (checkout API), not directly from the browser.
