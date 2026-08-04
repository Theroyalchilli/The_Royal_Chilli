-- Online payments (Stripe Checkout) for website orders + reservation deposits,
-- and email confirmations (Resend). Both are additive: nothing here changes
-- behavior for anyone who doesn't pay online / doesn't set a deposit amount.

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_method_check CHECK (method IN ('cash','card','card_online'));

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMPTZ;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

-- 0 = deposits disabled (default, unchanged behavior). Owner sets this in
-- Settings once they want to require a deposit on new reservations.
INSERT INTO app_settings (key, value)
VALUES ('reservation_deposit_amount', '0')
ON CONFLICT (key) DO NOTHING;
