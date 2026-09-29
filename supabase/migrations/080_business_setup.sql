-- 080 — Business setup page (Phase 3).
--
-- Each business's details are entered once on the Business setup page and the
-- system reads them from here, instead of code saying "The Royal Chilli".
--
--  • businesses: identity, addresses, tax & VAT, receipts & numbering, website
--    legal pages. Readable by the business's own staff screens.
--  • business_private: the owner-only details — bank account and the
--    encrypted Stripe / SumUp keys. Kept apart so they can never ride along
--    with the business's everyday details. Payment keys are stored only as
--    ciphertext (encrypted by the app with SETTINGS_ENCRYPTION_KEY).
--  • business_settings: each business's own copy of what was one shared list
--    (app_settings): opening hours, busy mode, rewards rules, attendance
--    rules, restaurant location, card reader, site text… The Royal Chilli
--    starts with today's values; app_settings is left as it is until the code
--    has moved over, so nothing changes for the live system.
--
-- Safe to re-run (never overwrites a value already filled in).

BEGIN;

-- ── business details ─────────────────────────────────────────────────────────
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS website            TEXT,
  ADD COLUMN IF NOT EXISTS registered_address JSONB,   -- { line1, line2, city, county, postcode }
  ADD COLUMN IF NOT EXISTS trading_address    JSONB,   -- printed on receipts
  ADD COLUMN IF NOT EXISTS vat_registered     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vat_rate           NUMERIC(5,4) NOT NULL DEFAULT 0.20,
  ADD COLUMN IF NOT EXISTS vat_scheme         TEXT,    -- e.g. standard, flat rate, cash accounting
  ADD COLUMN IF NOT EXISTS utr                TEXT,
  ADD COLUMN IF NOT EXISTS paye_reference     TEXT,
  ADD COLUMN IF NOT EXISTS year_end           TEXT,    -- DD-MM, e.g. 31-03
  ADD COLUMN IF NOT EXISTS accounts_email     TEXT,
  ADD COLUMN IF NOT EXISTS receipt_header     TEXT,
  ADD COLUMN IF NOT EXISTS receipt_footer     TEXT,
  ADD COLUMN IF NOT EXISTS order_prefix       TEXT,    -- RC-20260929-001
  ADD COLUMN IF NOT EXISTS po_prefix          TEXT NOT NULL DEFAULT 'PO',
  ADD COLUMN IF NOT EXISTS privacy_policy     TEXT,
  ADD COLUMN IF NOT EXISTS terms              TEXT,
  ADD COLUMN IF NOT EXISTS refund_policy      TEXT,
  ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ NOT NULL DEFAULT now();

-- ── owner-only details ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS business_private (
  business_id               INT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  bank_name                 TEXT,
  account_name              TEXT,
  account_number            TEXT,
  sort_code                 TEXT,
  iban                      TEXT,
  swift_bic                 TEXT,
  stripe_publishable_key    TEXT,          -- public by design
  stripe_secret_key_enc     TEXT,          -- ciphertext only
  stripe_webhook_secret_enc TEXT,          -- ciphertext only
  sumup_merchant_code       TEXT,
  sumup_api_key_enc         TEXT,          -- ciphertext only
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                INT REFERENCES staff(id)
);
ALTER TABLE business_private ENABLE ROW LEVEL SECURITY;   -- server only
INSERT INTO business_private (business_id) SELECT id FROM businesses ON CONFLICT DO NOTHING;

-- ── each business's own settings ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS business_settings (
  business_id INT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  value       JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, key)
);
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;  -- server only

-- The Royal Chilli starts with today's settings (the print-station key stays
-- where it is — it's a device secret, not a setting).
INSERT INTO business_settings (business_id, key, value, updated_at)
SELECT 1, key, value, COALESCE(updated_at, now()) FROM app_settings WHERE key <> 'print_station_key_hash'
ON CONFLICT (business_id, key) DO NOTHING;

-- ── fill in what's already known (never overwrite) ──────────────────────────
-- First run only (order_prefix not set yet): The Royal Chilli's bills already
-- charge VAT, at the rate in today's settings.
UPDATE businesses SET
  vat_registered = true,
  vat_rate       = COALESCE((SELECT (value #>> '{}')::numeric FROM app_settings WHERE key = 'vat_rate'), vat_rate)
WHERE id = 1 AND order_prefix IS NULL;

UPDATE businesses SET
  website         = COALESCE(website, 'https://www.theroyalchilli.com'),
  trading_address = COALESCE(trading_address, '{"line1": "43 Kingsley Road", "city": "Hounslow", "county": "London", "postcode": "TW3 1PA"}'::jsonb),
  phone           = COALESCE(phone, '020 8797 3044'),
  logo_url        = COALESCE(logo_url, '/logo.png'),
  order_prefix    = COALESCE(order_prefix, 'RC')
WHERE id = 1;

UPDATE businesses SET
  trading_address = COALESCE(trading_address, '{"line1": "45 Kingsley Road", "city": "Hounslow", "postcode": "TW3 1PA"}'::jsonb),
  order_prefix    = COALESCE(order_prefix, 'MH')
WHERE id = 2;
UPDATE businesses SET order_prefix = COALESCE(order_prefix, 'AB') WHERE id = 3;
UPDATE businesses SET order_prefix = COALESCE(order_prefix, 'EF') WHERE id = 4;

COMMIT;
