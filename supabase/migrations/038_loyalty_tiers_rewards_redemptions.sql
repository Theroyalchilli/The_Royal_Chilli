-- Loyalty Phase 1: configurable tiers, a richer reward catalogue, and
-- code-based redemption at the till (issue a code now, redeem it later at
-- POS — two steps, not an instant deduct, so a redemption has a real audit
-- trail: who issued it, who redeemed it, against which order).

-- Tiers were previously hardcoded in lib/crm.ts (tierFromSpend: >=500 Gold,
-- >=200 Silver, else Bronze) with no multiplier applied anywhere. Seeded
-- here with the same thresholds so behaviour doesn't silently change until
-- an admin edits them from Settings.
CREATE TABLE IF NOT EXISTS loyalty_tiers (
  id                  SERIAL PRIMARY KEY,
  name                TEXT NOT NULL UNIQUE,
  min_lifetime_spend  NUMERIC(10,2) NOT NULL DEFAULT 0,
  points_multiplier   NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  sort_order          INT NOT NULL DEFAULT 0,
  active              INT NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO loyalty_tiers (name, min_lifetime_spend, points_multiplier, sort_order) VALUES
  ('Bronze', 0,   1.0, 0),
  ('Silver', 200, 1.25, 1),
  ('Gold',   500, 1.5, 2)
ON CONFLICT (name) DO NOTHING;

-- A tier change is itself an event worth a record (doc requirement) —
-- separate from the points ledger since it carries no points_delta of its
-- own and loyalty_transactions.reason is a closed CHECK list.
CREATE TABLE IF NOT EXISTS loyalty_tier_changes (
  id            SERIAL PRIMARY KEY,
  customer_id   INT REFERENCES customers(id) NOT NULL,
  from_tier_id  INT REFERENCES loyalty_tiers(id),
  to_tier_id    INT REFERENCES loyalty_tiers(id) NOT NULL,
  lifetime_spend_at_change NUMERIC(10,2) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Tier-multiplier bonus points are a separate ledger line from the base
-- earn (doc: "do not simply create an unexplained total"), so the reason
-- list needs a new value.
ALTER TABLE loyalty_transactions DROP CONSTRAINT IF EXISTS loyalty_transactions_reason_check;
ALTER TABLE loyalty_transactions ADD CONSTRAINT loyalty_transactions_reason_check
  CHECK (reason IN ('earned_purchase', 'tier_bonus', 'redeemed_reward', 'birthday_bonus', 'referral_bonus', 'manual_adjustment'));

-- Reward catalogue: was name + points_cost only. Add what's needed for real
-- eligibility checks and an optional automatic £ discount (a reward with no
-- discount_amount, e.g. "Free soft drink", is comped by staff by hand —
-- there's no per-item comp system here, redemption just proves entitlement).
ALTER TABLE loyalty_rewards ADD COLUMN IF NOT EXISTS discount_amount    NUMERIC(10,2);
ALTER TABLE loyalty_rewards ADD COLUMN IF NOT EXISTS min_spend          NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE loyalty_rewards ADD COLUMN IF NOT EXISTS eligible_tier_id   INT REFERENCES loyalty_tiers(id);
ALTER TABLE loyalty_rewards ADD COLUMN IF NOT EXISTS valid_days         INT NOT NULL DEFAULT 7;
ALTER TABLE loyalty_rewards ADD COLUMN IF NOT EXISTS per_customer_limit INT;
ALTER TABLE loyalty_rewards ADD COLUMN IF NOT EXISTS start_date         DATE;
ALTER TABLE loyalty_rewards ADD COLUMN IF NOT EXISTS end_date           DATE;

-- A redemption is issued (points debited, code generated) and later redeemed
-- (code entered at POS, applied to a specific order) — two steps, so
-- "redeem" can be validated and audited independently of "issue".
CREATE TABLE IF NOT EXISTS loyalty_redemptions (
  id                  SERIAL PRIMARY KEY,
  code                TEXT NOT NULL UNIQUE,
  customer_id         INT REFERENCES customers(id) NOT NULL,
  reward_id           INT REFERENCES loyalty_rewards(id) NOT NULL,
  points_spent        INT NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('issued', 'redeemed', 'expired', 'cancelled')) DEFAULT 'issued',
  issued_at           TIMESTAMPTZ DEFAULT NOW(),
  issued_by_staff_id  INT REFERENCES staff(id),
  expires_at          TIMESTAMPTZ NOT NULL,
  redeemed_at         TIMESTAMPTZ,
  redeemed_by_staff_id INT REFERENCES staff(id),
  redeemed_order_id   INT REFERENCES orders(id)
);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_customer ON loyalty_redemptions(customer_id);

-- Configurable points-earning rate — was a hardcoded "1 point per £1"
-- (Math.floor(orderTotal)) in lib/customers.ts.
INSERT INTO app_settings (key, value) VALUES
  ('loyalty_points_per_pound', '1')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE loyalty_tiers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_tier_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_redemptions  ENABLE ROW LEVEL SECURITY;
-- No anon policies: server-only, same as the rest of Staff Hub / POS.
