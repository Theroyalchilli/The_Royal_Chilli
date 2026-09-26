-- print_jobs becomes the single print queue for the Star mC-Print3 (CloudPRNT):
-- every kitchen ticket (till, table QR, website) and every customer receipt
-- goes through it — no browser tab or local device involved.
--
-- Tickets are now rendered when the printer fetches them (so the printer can
-- be sent StarPRNT or plain text, whichever it asks for), not snapshotted at
-- queue time — content becomes optional and is only kept for old rows.

ALTER TABLE print_jobs ALTER COLUMN content DROP NOT NULL;

ALTER TABLE print_jobs
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'kot' CHECK (kind IN ('kot', 'receipt')),
  -- Where the order came from, printed as a label on the ticket. NULL = a
  -- manual reprint from staff.
  ADD COLUMN IF NOT EXISTS source TEXT CHECK (source IN ('till', 'qr', 'online')),
  -- Which items this kitchen ticket covers. A table's 2nd QR round is added
  -- to the same open order, so the ticket must list only that round's items.
  -- NULL = every (non-cancelled) item on the order.
  ADD COLUMN IF NOT EXISTS item_ids INT[],
  -- Scheduled website orders wait until ~prep time before their slot.
  ADD COLUMN IF NOT EXISTS print_after TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS print_jobs_pending_idx
  ON print_jobs (print_after, id) WHERE printed_at IS NULL;

-- The printer was never connected while website orders were already queueing
-- tickets — without this, connecting it now would print every old website
-- order at once.
UPDATE print_jobs SET printed_at = NOW() WHERE printed_at IS NULL;
