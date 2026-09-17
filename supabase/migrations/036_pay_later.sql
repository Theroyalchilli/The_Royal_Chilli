-- "Pay Later" — a customer's card is declined/blocked, or they otherwise
-- can't pay right now; staff mark the order deferred instead of forcing it
-- to stay open indefinitely. Deliberately a separate flag rather than a new
-- order `status` value, since the order's own status (open/sent_to_kitchen/
-- ready/paid/cancelled) keeps its existing meaning for kitchen-flow
-- purposes — this just layers "and also, don't expect payment yet" on top.
-- Stays true permanently even after eventual payment, as a historical
-- record of how often this happens — "outstanding" is derived from
-- amount_paid/status, not from clearing this flag.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pay_later BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pay_later_note TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_pay_later ON orders (pay_later) WHERE pay_later = TRUE;
