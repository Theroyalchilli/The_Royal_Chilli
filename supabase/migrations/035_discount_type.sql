-- Percent discounts were previously computed client-side into a frozen flat
-- amount and sent to the server as a plain number, so they went stale the
-- moment the order changed (an item added/voided after applying "10% off"
-- left a wrong flat amount instead of recalculating). Storing the rule
-- (type + value) lets the server recompute it fresh from the current
-- subtotal every time, same as service_charge_pct already works.
--
-- `discount` stays as the resolved flat amount (kept in sync by the app on
-- every recalculation) so existing reads that just want "how much off in
-- pounds" don't need to change.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS discount_type TEXT CHECK (discount_type IN ('percent', 'amount')),
  ADD COLUMN IF NOT EXISTS discount_pct  NUMERIC(5,2) CHECK (discount_pct >= 0 AND discount_pct <= 100);
