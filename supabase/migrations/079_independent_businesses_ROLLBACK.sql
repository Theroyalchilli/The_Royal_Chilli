-- ROLLBACK for 079_independent_businesses.sql — only if it has to be undone,
-- and only while every staff member, supplier and customer is still The Royal
-- Chilli's (and no owner login has been added).

BEGIN;

-- links: back to the 076 rules
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['purchase_orders', 'ingredients', 'fs_delivery_check', 'loyalty_transactions',
                           'shifts', 'attendance', 'timesheets', 'leave_requests', 'employee_payslips'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_match_business ON %I', t);
  END LOOP;
END $$;
DROP TRIGGER IF EXISTS trg_match_business ON orders;
CREATE TRIGGER trg_match_business BEFORE INSERT OR UPDATE ON orders FOR EACH ROW
  EXECUTE FUNCTION check_business_match('restaurant_tables', 'table_id', 'work_periods', 'work_period_id');
DROP TRIGGER IF EXISTS trg_match_business ON reservations;
CREATE TRIGGER trg_match_business BEFORE INSERT OR UPDATE ON reservations FOR EACH ROW
  EXECUTE FUNCTION check_business_match('restaurant_tables', 'table_id');
DROP TRIGGER IF EXISTS trg_inherit_business ON loyalty_redemptions;

-- unique rules
DROP INDEX IF EXISTS customers_business_email_account_unique;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_business_phone_unique;
ALTER TABLE newsletter_subscribers DROP CONSTRAINT IF EXISTS newsletter_business_email_unique;
ALTER TABLE loyalty_tiers DROP CONSTRAINT IF EXISTS loyalty_tiers_business_name_unique;

-- columns
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['staff', 'suppliers', 'customers', 'loyalty_tiers', 'loyalty_rewards', 'loyalty_redemptions', 'newsletter_subscribers'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_keep_business ON %I', t);
    EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS business_id', t);
  END LOOP;
END $$;
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_business_or_owner;
ALTER TABLE staff DROP COLUMN IF EXISTS is_owner;

COMMIT;
