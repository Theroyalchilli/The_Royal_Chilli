-- Online ordering gap: scheduled pickup/delivery time for collection and delivery orders.
-- Null means ASAP (today's existing behaviour).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;
