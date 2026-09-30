-- 082 — Tagline on Business setup; Royal Chilli's receipt wording moved out of code.
--
-- The till header, Staff Hub and receipts now read everything from Business
-- setup (step 4). Two things were still written in code for The Royal
-- Chilli: its tagline "Dil Se Desi" and the receipt's last line "Thank you
-- for dining with us." — they become setup fields, pre-filled here so
-- nothing changes on its receipts.
--
-- Safe to re-run (never overwrites a value already filled in).
-- Rollback: ALTER TABLE businesses DROP COLUMN tagline;

BEGIN;

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS tagline TEXT;

UPDATE businesses SET
  tagline        = COALESCE(tagline, 'Dil Se Desi'),
  receipt_footer = COALESCE(receipt_footer, 'Thank you for dining with us.')
WHERE id = 1;

COMMIT;
