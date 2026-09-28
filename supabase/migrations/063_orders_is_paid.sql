-- "Is this order paid?" as one column the database keeps up to date itself.
--
-- orders.status alone isn't enough: an order paid online (Stripe) stays
-- "sent_to_kitchen"/"ready" while the kitchen works on it — only a till
-- payment sets status "paid" — so every report, analytics chart, P&L/VAT
-- figure and loyalty tier that filtered on status = 'paid' left online-paid
-- orders out. is_paid is true for a till-paid order OR one whose payments
-- cover its total, and never for a cancelled order. Mirrors isFullyPaid in
-- lib/payment-status.ts.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_paid BOOLEAN
  GENERATED ALWAYS AS (
    status IS DISTINCT FROM 'cancelled'
    AND (status = 'paid' OR (total > 0 AND COALESCE(amount_paid, 0) >= total - 0.009))
  ) STORED;

CREATE INDEX IF NOT EXISTS orders_is_paid_created_idx ON orders (created_at) WHERE is_paid;
