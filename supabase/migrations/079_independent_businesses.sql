-- 079 — Every business fully independent (Phase 2b).
--
-- Decided 29 Sep 2026: each business creates its own staff, suppliers and
-- customers (with its own rewards scheme). Nothing is shared between the
-- businesses; only the group owner sees across all of them.
--
--  • business_id on staff, suppliers, customers, loyalty tiers, rewards,
--    vouchers (redemptions) and the newsletter list. Everything that exists
--    today is The Royal Chilli's (business 1).
--  • staff.is_owner: the group owner's login. The owner belongs to no single
--    business (business_id NULL) and can work inside any of them.
--  • Customer phone / account email, newsletter email and rewards-tier names
--    become unique per business (the same phone can be a customer of two
--    businesses). The old group-wide rules are kept for now so the code live
--    while this runs keeps working; they're dropped just before a second
--    business opens (see "before launch" in docs/MULTI-BUSINESS.md).
--  • Staff usernames, employee numbers, voucher codes and referral codes stay
--    unique across the whole group.
--  • Database rules: an order / booking can't use another business's
--    customer; a purchase order, ingredient or delivery check can't use
--    another business's supplier; rota, attendance, timesheets, leave and
--    payslips can't use another business's staff; points and vouchers follow
--    their customer's business (or the order's). Rows never change business (077).
--
-- Safe to re-run. Rollback: 079_independent_businesses_ROLLBACK.sql.

BEGIN;

-- ── business_id ──────────────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['suppliers', 'customers', 'loyalty_tiers', 'loyalty_rewards', 'loyalty_redemptions', 'newsletter_subscribers'] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS business_id INT NOT NULL DEFAULT 1 REFERENCES businesses(id)', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (business_id)', 'idx_' || t || '_business', t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_keep_business ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_keep_business BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION keep_business_id()', t);
  END LOOP;
END $$;

-- Staff: a business, or the owner (no single business).
ALTER TABLE staff ADD COLUMN IF NOT EXISTS business_id INT DEFAULT 1 REFERENCES businesses(id);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_owner BOOLEAN NOT NULL DEFAULT false;
UPDATE staff SET business_id = 1 WHERE business_id IS NULL AND NOT is_owner;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_business_or_owner') THEN
    ALTER TABLE staff ADD CONSTRAINT staff_business_or_owner CHECK (business_id IS NOT NULL OR is_owner);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_staff_business ON staff (business_id);
DROP TRIGGER IF EXISTS trg_keep_business ON staff;
CREATE TRIGGER trg_keep_business BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION keep_business_id();

-- ── unique per business (old group-wide rules kept for now) ──────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_business_phone_unique') THEN
    ALTER TABLE customers ADD CONSTRAINT customers_business_phone_unique UNIQUE (business_id, phone);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'newsletter_business_email_unique') THEN
    ALTER TABLE newsletter_subscribers ADD CONSTRAINT newsletter_business_email_unique UNIQUE (business_id, email);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_tiers_business_name_unique') THEN
    ALTER TABLE loyalty_tiers ADD CONSTRAINT loyalty_tiers_business_name_unique UNIQUE (business_id, name);
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS customers_business_email_account_unique
  ON customers (business_id, lower(email)) WHERE password_hash IS NOT NULL;

-- ── children follow their parent's business ──────────────────────────────────
-- Points entries: an order's entries take the order's business (078); any
-- other entry (sign-up bonus, birthday, manual adjustment, expiry, merge)
-- takes its customer's business.
CREATE OR REPLACE FUNCTION loyalty_business_from_order() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE bid int;
BEGIN
  IF NEW.reference_type IN ('order', 'cash_credit', 'visit_bonus') AND NEW.reference_id IS NOT NULL THEN
    SELECT business_id INTO bid FROM orders WHERE id = NEW.reference_id;
  END IF;
  IF bid IS NULL AND NEW.customer_id IS NOT NULL THEN
    SELECT business_id INTO bid FROM customers WHERE id = NEW.customer_id;
  END IF;
  IF bid IS NOT NULL THEN NEW.business_id := bid; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_inherit_business ON loyalty_redemptions;
CREATE TRIGGER trg_inherit_business BEFORE INSERT OR UPDATE ON loyalty_redemptions
  FOR EACH ROW EXECUTE FUNCTION inherit_business_id('customers', 'customer_id');

-- ── links must stay inside one business ──────────────────────────────────────
-- (check_business_match from 076 ignores a parent with no business — the owner.)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('orders',              ARRAY['restaurant_tables', 'table_id', 'work_periods', 'work_period_id', 'customers', 'customer_id']),
    ('reservations',        ARRAY['restaurant_tables', 'table_id', 'customers', 'customer_id']),
    ('purchase_orders',     ARRAY['suppliers', 'supplier_id']),
    ('ingredients',         ARRAY['suppliers', 'supplier_id']),
    ('fs_delivery_check',   ARRAY['suppliers', 'supplier_id']),
    ('loyalty_transactions', ARRAY['customers', 'customer_id']),
    ('shifts',              ARRAY['staff', 'staff_id']),
    ('attendance',          ARRAY['staff', 'staff_id']),
    ('timesheets',          ARRAY['staff', 'staff_id']),
    ('leave_requests',      ARRAY['staff', 'staff_id']),
    ('employee_payslips',   ARRAY['staff', 'staff_id'])
  ) v(tbl, args)
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_match_business ON %I', r.tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_match_business BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION check_business_match(%s)',
      r.tbl, (SELECT string_agg(quote_literal(a), ', ') FROM unnest(r.args) a));
  END LOOP;
END $$;

COMMIT;
