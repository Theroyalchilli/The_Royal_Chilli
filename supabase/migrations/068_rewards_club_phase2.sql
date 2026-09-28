-- Rewards Club, phase 2: Bring a Friend vouchers, and referral codes for
-- every member.
--
-- Bring a Friend: when a friend signs up with a member's link, the member
-- gets a £5 dine-in voucher straight away but LOCKED — it unlocks (and its
-- 30 days start) when the friend makes a first paid order of £20+. Replaces
-- the old 500/1,000 referral points.

-- A voucher can be locked until something happens (the friend's first visit)
ALTER TABLE loyalty_redemptions DROP CONSTRAINT IF EXISTS loyalty_redemptions_status_check;
ALTER TABLE loyalty_redemptions ADD CONSTRAINT loyalty_redemptions_status_check
  CHECK (status IN ('locked', 'issued', 'redeemed', 'expired', 'cancelled'));
-- which friend a referral voucher is for
ALTER TABLE loyalty_redemptions ADD COLUMN IF NOT EXISTS referred_customer_id INT REFERENCES customers(id);

-- The Bring a Friend reward: issued automatically, never bought with points,
-- kept out of the customer's points catalogue.
ALTER TABLE loyalty_rewards ADD COLUMN IF NOT EXISTS is_referral_reward BOOLEAN NOT NULL DEFAULT FALSE;
INSERT INTO loyalty_rewards
  (name, description, points_cost, active, discount_amount, order_types, valid_days, is_referral_reward)
SELECT
  'Bring a Friend £5 off (dine-in)',
  '£5 off your dine-in bill — thanks for bringing a friend. Valid 30 days from when your friend first visits.',
  0, 1, 5, ARRAY['dine_in'], 30, TRUE
WHERE NOT EXISTS (SELECT 1 FROM loyalty_rewards WHERE is_referral_reward);

-- Old referral points off (the voucher replaces them); cap per member.
UPDATE app_settings SET value = '0', updated_at = NOW()
  WHERE key IN ('loyalty_referral_referee_points', 'loyalty_referral_referrer_points');
INSERT INTO app_settings (key, value) VALUES ('loyalty_referral_max_per_year', '10')
ON CONFLICT (key) DO NOTHING;

-- Every member gets a referral code to share (only staff-added customers had one).
UPDATE customers
SET referral_code = 'RC' || upper(substr(md5(random()::text || id::text), 1, 6))
WHERE referral_code IS NULL;
