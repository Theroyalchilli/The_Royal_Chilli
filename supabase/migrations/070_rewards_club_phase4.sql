-- Rewards Club, phase 4: emails. The "we'd love to see you again" nudge goes
-- once per customer, 10 days after their first visit if they haven't been
-- back — this marks it sent so the daily job never repeats it.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS nudge_sent_at TIMESTAMPTZ;
