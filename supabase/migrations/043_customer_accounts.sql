-- Customer self-service accounts (Phase 1: auth foundation). Existing
-- customer rows are created automatically from phone-based checkout/
-- reservation flows (see lib/customers.ts:findOrCreateCustomerByPhone) and
-- never had a password — this lets a customer "claim" one of those rows by
-- signing up with the same email, so their real order/loyalty history shows
-- up immediately instead of starting a duplicate blank account.
--
-- Signup only collects name + email (no phone — that's added later from the
-- profile), so phone can no longer be required. Postgres UNIQUE constraints
-- already treat multiple NULLs as distinct, so relaxing NOT NULL doesn't
-- allow phone collisions.
ALTER TABLE customers ALTER COLUMN phone DROP NOT NULL;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Only enforced among rows that actually have an account — a guest row
-- created by phone-only checkout may share no email with anyone, or share
-- one with a household member, without blocking either from later signing
-- up for their own account.
CREATE UNIQUE INDEX IF NOT EXISTS customers_email_account_unique
  ON customers (lower(email))
  WHERE password_hash IS NOT NULL;
