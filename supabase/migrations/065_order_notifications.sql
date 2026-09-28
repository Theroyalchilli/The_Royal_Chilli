-- One-time customer emails per order (Batch 4), so a redelivered event or a
-- re-bumped kitchen ticket can't send the same email twice:
--  ready_notified_at   — "Your order is ready" (website collection/delivery)
--  review_requested_at — "How was your meal?" the day after (opted-in only)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ready_notified_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS review_requested_at TIMESTAMPTZ;
