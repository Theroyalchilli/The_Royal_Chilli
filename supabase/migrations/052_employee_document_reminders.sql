-- Tracks which expiry reminders have already fired for a document, so the
-- daily cron never re-sends the same threshold notification twice. Three
-- flags (not one "last reminded" timestamp) so a cron gap that skips past
-- one threshold still sends the others it missed on its next run.
ALTER TABLE employee_documents
  ADD COLUMN IF NOT EXISTS reminder_60_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_30_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_7_sent BOOLEAN NOT NULL DEFAULT false;
