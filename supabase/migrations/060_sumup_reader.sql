-- SumUp Solo at the till (lib/sumup.ts). Outcomes SumUp posts to
-- /api/sumup/webhook, one row per reader checkout. Only used as a hint that a
-- payment failed (the webhook isn't signed) — success is always confirmed
-- from SumUp's Transactions API.
CREATE TABLE IF NOT EXISTS sumup_reader_events (
  client_transaction_id TEXT PRIMARY KEY,
  status                TEXT NOT NULL CHECK (status IN ('successful', 'failed')),
  failure_reason        TEXT,
  received_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sumup_reader_events ENABLE ROW LEVEL SECURITY;
