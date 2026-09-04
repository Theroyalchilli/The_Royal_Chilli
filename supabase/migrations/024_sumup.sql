-- SumUp replaces Stripe for online checkout (and, separately, the till
-- reader — see app/api/pos/terminal/* — which doesn't need a schema change).
-- stripe_session_id columns are left in place, unused, as the rollback path.
--
-- No payments table change needed: payments.method = 'card_online' is
-- already provider-agnostic, and the SumUp checkout id just goes in the
-- existing generic `reference` column, same as Stripe's session id does.

ALTER TABLE orders       ADD COLUMN IF NOT EXISTS sumup_checkout_id TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS sumup_checkout_id TEXT;
