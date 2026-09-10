-- Roles consolidated 12 → 4: employee, manager, hr, admin.
--   employee — front line: POS + kitchen, no Staff Hub
--   manager  — operations (menu, tables, inventory, analytics) + attendance,
--              finance, reports
--   hr       — people & pay: attendance, HR (incl. payroll), finance, reports
--   admin    — everything, incl. Settings + Audit Log
--
-- role_permissions switches to one key per Staff Hub tab (tab-level access,
-- editable in Settings). See lib/permissions.ts.

BEGIN;

-- 1. remap existing accounts (do this before tightening the CHECK)
UPDATE staff SET role = CASE role
  WHEN 'owner'             THEN 'admin'
  WHEN 'admin'             THEN 'admin'
  WHEN 'manager'           THEN 'manager'
  WHEN 'supervisor'        THEN 'manager'
  WHEN 'inventory_manager' THEN 'manager'
  WHEN 'accountant'        THEN 'hr'
  ELSE 'employee'   -- cashier, waiter, chef, kitchen, driver, employee
END;

-- 2. new CHECK
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check
  CHECK (role IN ('employee', 'manager', 'hr', 'admin'));
ALTER TABLE staff ALTER COLUMN role SET DEFAULT 'employee';

-- 3. rebuild role_permissions with the per-tab keys + the agreed matrix.
--    admin is implicit-allow and employee implicit-deny in code, so only the
--    manager / hr grants are stored.
DELETE FROM role_permissions;

INSERT INTO role_permissions (role, permission, granted) VALUES
  ('manager', 'attendance', true),
  ('manager', 'menu',       true),
  ('manager', 'tables',     true),
  ('manager', 'inventory',  true),
  ('manager', 'finance',    true),
  ('manager', 'analytics',  true),
  ('manager', 'reports',    true),
  ('hr',      'attendance', true),
  ('hr',      'hr',         true),
  ('hr',      'finance',    true),
  ('hr',      'reports',    true);

COMMIT;
