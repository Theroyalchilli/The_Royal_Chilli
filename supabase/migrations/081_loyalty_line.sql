-- 081 — Loyalty gets its own line on the bill.
--
-- Until now a loyalty reward (voucher code or "use my points") was written
-- into the order's one `discount` field, so it REPLACED any staff discount.
-- Now both apply: a staff discount AND loyalty on the same bill (owner's
-- choice, 2026-09-30). The bill works out as:
--   subtotal − discount − loyalty = food → + service charge = total
-- (tip is per payment, on top). VAT is on the food only — never on service
-- charge or tip.
--
-- Loyalty also records who applied it (every till user can now use a
-- customer's points, and we need to know who did).
--
-- Existing orders whose discount was really a loyalty reward move over to
-- the new columns — their totals don't change (both come off the bill).
--
-- Safe to re-run. Rollback: move the loyalty rows back into discount, then
-- DROP the four columns.

BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS loyalty_discount           NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_reason             TEXT,
  ADD COLUMN IF NOT EXISTS loyalty_given_by_staff_id  INT REFERENCES staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS loyalty_given_by           TEXT;

UPDATE orders SET
  loyalty_discount = discount,
  loyalty_reason   = discount_reason,
  discount         = 0,
  discount_type    = NULL,
  discount_pct     = NULL,
  discount_reason  = NULL,
  discount_given_by_staff_id = NULL,
  discount_given_by = NULL
WHERE discount_reason LIKE 'Loyalty%'
  AND COALESCE(loyalty_discount, 0) = 0;

COMMIT;
