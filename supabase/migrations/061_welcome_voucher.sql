-- Welcome voucher: signing up for an online account now gives a one-time
-- 20% off voucher for a dine-in visit (max £20, valid 30 days) instead of 50
-- bonus points (lib/customers.ts signupCustomer → issueWelcomeVoucher).

-- Percentage rewards (discount_amount stays the £-off kind), an optional cap
-- on them, and which order types a reward can be used on (NULL = any).
ALTER TABLE loyalty_rewards ADD COLUMN IF NOT EXISTS discount_pct   NUMERIC(5,2) CHECK (discount_pct > 0 AND discount_pct <= 100);
ALTER TABLE loyalty_rewards ADD COLUMN IF NOT EXISTS max_discount   NUMERIC(10,2) CHECK (max_discount > 0);
ALTER TABLE loyalty_rewards ADD COLUMN IF NOT EXISTS order_types    TEXT[];

-- Same idea as is_birthday_reward: issued automatically, never bought with
-- points, and kept out of the customer's reward catalogue.
ALTER TABLE loyalty_rewards ADD COLUMN IF NOT EXISTS is_welcome_reward BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO loyalty_rewards
  (name, description, points_cost, active, discount_pct, max_discount, order_types, valid_days, per_customer_limit, is_welcome_reward)
SELECT
  'Welcome 20% off (dine-in)',
  '20% off your bill when you dine in with us — up to £20. One use, valid 30 days from sign-up.',
  0, 1, 20, 20, ARRAY['dine_in'], 30, 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM loyalty_rewards WHERE is_welcome_reward);
