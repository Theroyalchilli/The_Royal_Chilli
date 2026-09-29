-- ROLLBACK for 076_multi_business_foundation.sql — only if it has to be undone.
-- Safe while The Royal Chilli is the only business with data (every row is
-- business 1). Restores the original database-wide unique constraints.

BEGIN;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('menu_items', 'inherit'), ('featured_dishes', 'inherit'), ('recipes', 'inherit'),
    ('payments', 'inherit'), ('print_jobs', 'inherit'), ('table_requests', 'inherit'),
    ('stock_movements', 'inherit'), ('supplier_payments', 'inherit'), ('fs_check_log', 'inherit'),
    ('fs_temp_log', 'inherit'), ('fs_delivery_check', 'inherit'), ('attendance', 'inherit'),
    ('orders', 'match'), ('reservations', 'match')
  ) v(tbl, kind)
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'trg_' || r.kind || '_business', r.tbl);
  END LOOP;
END $$;
DROP FUNCTION IF EXISTS inherit_business_id();
DROP FUNCTION IF EXISTS check_business_match();

ALTER TABLE orders          DROP CONSTRAINT IF EXISTS orders_business_unique;
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_business_unique;
ALTER TABLE payroll_periods DROP CONSTRAINT IF EXISTS payroll_periods_business_unique;
ALTER TABLE fs_signoff      DROP CONSTRAINT IF EXISTS fs_signoff_business_unique;
ALTER TABLE orders          ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_order_number_key UNIQUE (order_number);
ALTER TABLE payroll_periods ADD CONSTRAINT payroll_periods_period_start_period_end_key UNIQUE (period_start, period_end);
ALTER TABLE fs_signoff      ADD CONSTRAINT fs_signoff_day_key UNIQUE (day);

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
    'audit_logs', 'loyalty_transactions'
  ] LOOP
    EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS business_id', t);
  END LOOP;
END $$;

-- platform_sales keeps its business_id column (it predates 076); just the key goes.
ALTER TABLE platform_sales DROP CONSTRAINT IF EXISTS platform_sales_business_id_fkey;

DROP TABLE IF EXISTS staff_businesses;
DROP TABLE IF EXISTS businesses;

COMMIT;
