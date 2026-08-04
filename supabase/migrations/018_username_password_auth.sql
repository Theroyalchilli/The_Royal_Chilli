-- Replaces the PIN-tile login with traditional username + password, per
-- explicit request. pin_hash is kept (now nullable) rather than dropped —
-- no functional reason to remove it, and keeping it is the safer, more
-- reversible choice. Nothing else in the app reads pin_hash for authorization
-- (confirmed: only the login route and staff-management screens ever
-- touched it), so this is a clean, contained swap.

ALTER TABLE staff ALTER COLUMN pin_hash DROP NOT NULL;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS password_hash TEXT;
