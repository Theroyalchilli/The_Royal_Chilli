-- 077 — A row never changes business (multi-business, Phase 2).
--
-- 076 makes a child row take its parent's business (a menu item takes its
-- category's). On an UPDATE that would quietly move an existing row to
-- another business — e.g. a Royal Chilli dish edited into a Melt House
-- category would become a Melt House dish. This refuses any update that
-- changes business_id, however it happens (the column itself, or a new
-- parent that belongs to another business). The app already checks parents
-- belong to the right business; this is the database backstop.
--
-- Trigger order: Postgres runs BEFORE triggers alphabetically, so
-- trg_inherit_business (076) runs first and trg_keep_business sees the result.
-- Safe to re-run. Rollback: DROP the triggers and function below.

BEGIN;

CREATE OR REPLACE FUNCTION keep_business_id() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.business_id IS DISTINCT FROM OLD.business_id THEN
    RAISE EXCEPTION 'This % belongs to business % and can''t be moved to business %',
      TG_TABLE_NAME, OLD.business_id, NEW.business_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'menu_categories', 'menu_items', 'modifier_groups', 'featured_dishes', 'promotions',
    'restaurant_tables', 'table_requests', 'reservations', 'delivery_zones',
    'work_periods', 'orders', 'payments', 'print_jobs',
    'ingredients', 'recipes', 'stock_movements', 'stock_takes', 'purchase_orders',
    'supplier_payments', 'expenses',
    'fs_check_type', 'fs_check_log', 'fs_temp_type', 'fs_temp_log',
    'fs_delivery_check', 'fs_problem', 'fs_signoff',
    'shifts', 'attendance', 'timesheets', 'payroll_periods', 'employee_payslips', 'leave_requests',
    'audit_logs', 'loyalty_transactions', 'platform_sales'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_keep_business ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_keep_business BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION keep_business_id()', t);
  END LOOP;
END $$;

COMMIT;
