-- Customer account portal: addresses, and two new loyalty_transactions
-- reasons this needs that the existing closed CHECK list didn't cover.
--
-- 'welcome_bonus': a one-off signup incentive (see lib/customers.ts:signupCustomer).
-- 'redemption_cancelled': a customer cancelling their own not-yet-redeemed
-- voucher and getting the points back — distinct from 'manual_adjustment'
-- (which implies a staff member did it) since this is self-service.
ALTER TABLE loyalty_transactions DROP CONSTRAINT IF EXISTS loyalty_transactions_reason_check;
ALTER TABLE loyalty_transactions ADD CONSTRAINT loyalty_transactions_reason_check
  CHECK (reason IN ('earned_purchase', 'tier_bonus', 'redeemed_reward', 'birthday_bonus', 'referral_bonus', 'manual_adjustment', 'points_expired', 'refund_reversal', 'welcome_bonus', 'redemption_cancelled'));

CREATE TABLE IF NOT EXISTS customer_addresses (
  id          SERIAL PRIMARY KEY,
  customer_id INT REFERENCES customers(id) NOT NULL,
  label       TEXT NOT NULL DEFAULT 'Home',
  line        TEXT NOT NULL, -- street + area, free text (matches the account UI's single field)
  postcode    TEXT,          -- separate, since delivery-zone lookup (/api/public/delivery-zones/check) needs it on its own
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer ON customer_addresses(customer_id);
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;
-- No anon policies: server-only (customer session checked in the API route),
-- same pattern as every other customer-data table.

-- Seed a starter reward catalogue so the Loyalty tab has something real to
-- show — staff can edit/add more from Staff Hub. Matches the cash-off tier
-- pattern already used by the existing points-to-cash-credit feature.
INSERT INTO loyalty_rewards (name, description, points_cost, discount_amount, active)
SELECT * FROM (VALUES
  ('£5 off your order',  'Applied as a discount at checkout or the till', 500,  5.00,  1),
  ('£10 off your order', 'Applied as a discount at checkout or the till', 1000, 10.00, 1),
  ('£15 off your order', 'Applied as a discount at checkout or the till', 1500, 15.00, 1)
) AS v(name, description, points_cost, discount_amount, active)
WHERE NOT EXISTS (SELECT 1 FROM loyalty_rewards);
