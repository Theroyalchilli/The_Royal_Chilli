-- Rewards Club, phase 1: the new points rules (agreed 2026-09-28).
--   Earn £1 = 10 points (2× on Tue–Thu, UK time), spend 100 points = £1,
--   dine-in only, max £10 of points per visit (in £5 steps), no tier
--   multipliers, 200 points on sign-up, welcome voucher usable from the next
--   visit, existing balances ×10 to match the new rate.

-- Earning / spending settings
UPDATE app_settings SET value = '10', updated_at = NOW() WHERE key = 'loyalty_points_per_pound';
UPDATE app_settings SET value = '10', updated_at = NOW() WHERE key = 'loyalty_max_redeem_per_visit';
INSERT INTO app_settings (key, value) VALUES
  ('loyalty_points_per_pound',     '10'),
  ('loyalty_max_redeem_per_visit', '10'),
  ('loyalty_redeem_step',          '5'),       -- "Use my points" offers £5 or £10
  ('loyalty_signup_points',        '200'),
  ('loyalty_double_points_days',   '[2,3,4]')  -- ISO weekdays: Tue, Wed, Thu
ON CONFLICT (key) DO NOTHING;

-- Everyone earns the same rate: tier multipliers off (tiers kept in case
-- they come back).
UPDATE loyalty_tiers SET points_multiplier = 1;

-- Points and vouchers are for dine-in only; the £15 reward is retired (max
-- £10 of points per visit).
UPDATE loyalty_rewards SET order_types = ARRAY['dine_in'];
UPDATE loyalty_rewards SET active = 0 WHERE points_cost = 1500 AND discount_amount = 15 AND NOT is_welcome_reward;

-- A voucher can start on a later date — the welcome voucher is for the
-- *next* visit, so it isn't valid until the next trading day.
ALTER TABLE loyalty_redemptions ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ;

-- New ledger reasons: the Tue–Thu doubling, and (phase 3) visit bonuses.
ALTER TABLE loyalty_transactions DROP CONSTRAINT IF EXISTS loyalty_transactions_reason_check;
ALTER TABLE loyalty_transactions ADD CONSTRAINT loyalty_transactions_reason_check
  CHECK (reason IN ('earned_purchase', 'tier_bonus', 'redeemed_reward', 'birthday_bonus', 'referral_bonus', 'manual_adjustment', 'points_expired', 'refund_reversal', 'welcome_bonus', 'redemption_cancelled', 'midweek_bonus', 'visit_bonus'));

-- Existing balances ×10 (earned at the old £1 = 1 point). Adds 9× the
-- current balance as one ledger line per customer; safe to re-run.
INSERT INTO loyalty_transactions (customer_id, points_delta, reason, reference_type)
SELECT c.id, c.loyalty_points * 9, 'manual_adjustment', 'scheme_upgrade'
FROM customers c
WHERE c.loyalty_points > 0
  AND NOT EXISTS (
    SELECT 1 FROM loyalty_transactions t
    WHERE t.customer_id = c.id AND t.reference_type = 'scheme_upgrade'
  );
