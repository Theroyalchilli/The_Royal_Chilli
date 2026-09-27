-- Who gave a manual discount on an order. The till runs on one shared login,
-- so staff pick their name when applying a discount in the payment screen.
-- Shown on that order (Order History, payment screen) — not on the Z report.
-- Name kept alongside the id so it still reads right if the staff record
-- is later renamed or removed. Cleared when the discount is removed or a
-- loyalty voucher replaces it.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_given_by_staff_id INT REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_given_by TEXT;
