-- POS audit fixes: split-bill payments, tips, and service charge — none of which
-- were actually supported before (payment always force-closed the whole order
-- regardless of amount paid, which breaks paying a bill in installments).

ALTER TABLE payments ADD COLUMN IF NOT EXISTS tip_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_charge_pct NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_charge_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Running total of payments received against this order (excluding tips, which are
-- gratuity on top, not part of what's owed). A trigger keeps this in sync so partial
-- payments accumulate correctly instead of the order needing to be paid in one go.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION apply_payment_to_order() RETURNS TRIGGER AS $$
BEGIN
  UPDATE orders SET amount_paid = amount_paid + NEW.amount WHERE id = NEW.order_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_apply_payment_to_order ON payments;
CREATE TRIGGER trg_apply_payment_to_order AFTER INSERT ON payments
FOR EACH ROW EXECUTE FUNCTION apply_payment_to_order();
