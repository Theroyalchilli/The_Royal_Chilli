-- Module 6: Customers/CRM + Loyalty + Drivers.

CREATE TABLE IF NOT EXISTS customers (
  id                    SERIAL PRIMARY KEY,
  name                  TEXT NOT NULL,
  phone                 TEXT UNIQUE NOT NULL,
  email                 TEXT,
  date_of_birth         DATE,
  address               TEXT,
  notes                 TEXT,
  loyalty_points        INT NOT NULL DEFAULT 0,
  referral_code         TEXT UNIQUE,
  referred_by_customer_id INT REFERENCES customers(id),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Orders link to a customer once we know their phone number (website checkout,
-- reservation, or a POS order where staff entered a phone). Anonymous walk-ins/dine-in
-- stay unlinked, same as real life.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id INT REFERENCES customers(id);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS customer_id INT REFERENCES customers(id);

-- Points ledger — same audit-trail pattern as stock_movements. A trigger keeps
-- customers.loyalty_points in sync so there's no read-then-write race.
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id             SERIAL PRIMARY KEY,
  customer_id    INT REFERENCES customers(id) NOT NULL,
  points_delta   INT NOT NULL,
  reason         TEXT NOT NULL CHECK (reason IN ('earned_purchase', 'redeemed_reward', 'birthday_bonus', 'referral_bonus', 'manual_adjustment')),
  reference_type TEXT,
  reference_id   INT,
  staff_id       INT REFERENCES staff(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION apply_loyalty_transaction() RETURNS TRIGGER AS $$
BEGIN
  UPDATE customers SET loyalty_points = loyalty_points + NEW.points_delta WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_apply_loyalty_transaction ON loyalty_transactions;
CREATE TRIGGER trg_apply_loyalty_transaction AFTER INSERT ON loyalty_transactions
FOR EACH ROW EXECUTE FUNCTION apply_loyalty_transaction();

CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  points_cost  INT NOT NULL,
  active       INT DEFAULT 1,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Drivers: fields live directly on staff (same pattern as employment_type/pay_rate),
-- since a driver is just a staff member with role='driver' and a bit of extra data.
ALTER TABLE staff ADD COLUMN IF NOT EXISTS vehicle_type TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS vehicle_registration TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS driver_status TEXT CHECK (driver_status IN ('available', 'on_delivery', 'offline'));

ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_id INT REFERENCES staff(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_status TEXT CHECK (delivery_status IN ('unassigned', 'assigned', 'out_for_delivery', 'delivered')) DEFAULT 'unassigned';

ALTER TABLE customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rewards    ENABLE ROW LEVEL SECURITY;
-- No anon policies: server-only. Public order/reservation creation links customers
-- via the service_role server route, not directly from the browser.
