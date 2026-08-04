-- Configurable Roles & Permissions: the 6 permission checks in lib/permissions.ts
-- were hardcoded arrays in code (owner/admin could not change who has access to
-- what without a code deploy). This table makes them editable from the Settings UI.

CREATE TABLE IF NOT EXISTS role_permissions (
  role TEXT NOT NULL,
  permission TEXT NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (role, permission)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Seed every role x permission combination with the exact defaults that were
-- previously hardcoded, so behavior is unchanged until an owner/admin edits it.
INSERT INTO role_permissions (role, permission, granted)
SELECT r.role, p.permission, false
FROM unnest(ARRAY['owner','admin','manager','supervisor','cashier','waiter','chef','kitchen','driver','inventory_manager','accountant','employee']) AS r(role)
CROSS JOIN unnest(ARRAY['manage_staff','manage_inventory','view_crm','manage_crm','manage_drivers','manage_finance']) AS p(permission)
ON CONFLICT (role, permission) DO NOTHING;

UPDATE role_permissions SET granted = true WHERE permission = 'manage_staff' AND role IN ('owner','admin','manager');
UPDATE role_permissions SET granted = true WHERE permission = 'manage_inventory' AND role IN ('owner','admin','manager','inventory_manager');
UPDATE role_permissions SET granted = true WHERE permission = 'view_crm' AND role IN ('owner','admin','manager','supervisor','cashier','waiter');
UPDATE role_permissions SET granted = true WHERE permission = 'manage_crm' AND role IN ('owner','admin','manager');
UPDATE role_permissions SET granted = true WHERE permission = 'manage_drivers' AND role IN ('owner','admin','manager');
UPDATE role_permissions SET granted = true WHERE permission = 'manage_finance' AND role IN ('owner','admin','manager','accountant');
