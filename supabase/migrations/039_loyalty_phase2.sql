-- Loyalty Phase 2: points expiry, birthday rewards, referral completion,
-- win-back segmentation, refund reversal.

-- Points expiry: each earning transaction carries its own expiry (based on a
-- configurable months setting, applied at earn time); expiry_swept marks a
-- row as already accounted for by an expiry sweep, whether it actually
-- expired or was consumed by a later redemption first — either way it
-- should never be swept twice.
ALTER TABLE loyalty_transactions ADD COLUMN IF NOT EXISTS expires_at    TIMESTAMPTZ;
ALTER TABLE loyalty_transactions ADD COLUMN IF NOT EXISTS expiry_swept  BOOLEAN NOT NULL DEFAULT FALSE;

-- expiry reason for the reversal entries themselves.
ALTER TABLE loyalty_transactions DROP CONSTRAINT IF EXISTS loyalty_transactions_reason_check;
ALTER TABLE loyalty_transactions ADD CONSTRAINT loyalty_transactions_reason_check
  CHECK (reason IN ('earned_purchase', 'tier_bonus', 'redeemed_reward', 'birthday_bonus', 'referral_bonus', 'manual_adjustment', 'points_expired', 'refund_reversal'));

-- Birthday reward: an admin flags one (or more) catalogue reward as the
-- automatic birthday gift — the daily cron issues it the same way staff
-- issue any other reward (same code/expiry/redeem-at-POS flow), just
-- triggered automatically instead of by a staff click, and free (points_cost
-- expected to be 0 for these).
ALTER TABLE loyalty_rewards ADD COLUMN IF NOT EXISTS is_birthday_reward BOOLEAN NOT NULL DEFAULT FALSE;

-- Referral was previously rewarded immediately on the referred customer's
-- registration (see app/api/customers POST) — the doc explicitly calls that
-- out as wrong: wait for a qualifying purchase. referral_completed_at marks
-- when (if ever) that qualifying purchase happened, so it can only fire once.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral_completed_at TIMESTAMPTZ;

-- Configurable Phase 2 business rules (same app_settings pattern as the rest
-- of the app — VAT rate, overtime, attendance config, loyalty_points_per_pound).
INSERT INTO app_settings (key, value) VALUES
  ('loyalty_points_expiry_months',   '12'),
  ('loyalty_birthday_points',        '0'),
  ('loyalty_referral_min_spend',     '20'),
  ('loyalty_referral_referee_points','500'),
  ('loyalty_referral_referrer_points','1000'),
  ('loyalty_winback_days',           '45')
ON CONFLICT (key) DO NOTHING;
