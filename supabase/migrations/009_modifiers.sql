-- Online ordering gap: item modifiers (spice level, extras, etc).
-- Groups are reusable across menu items rather than duplicated per item.

CREATE TABLE IF NOT EXISTS modifier_groups (
  id             SERIAL PRIMARY KEY,
  name           TEXT NOT NULL, -- e.g. "Spice Level", "Extras"
  selection_type TEXT NOT NULL CHECK (selection_type IN ('single', 'multiple')) DEFAULT 'single',
  min_select     INT NOT NULL DEFAULT 0,
  max_select     INT, -- null = unlimited (only relevant when selection_type = 'multiple')
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS modifier_options (
  id            SERIAL PRIMARY KEY,
  group_id      INT REFERENCES modifier_groups(id) ON DELETE CASCADE NOT NULL,
  name          TEXT NOT NULL, -- e.g. "Hot", "Extra Cheese"
  price_delta   NUMERIC(10,2) NOT NULL DEFAULT 0,
  display_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_item_modifier_groups (
  id            SERIAL PRIMARY KEY,
  menu_item_id  INT REFERENCES menu_items(id) ON DELETE CASCADE NOT NULL,
  group_id      INT REFERENCES modifier_groups(id) ON DELETE CASCADE NOT NULL,
  required      INT NOT NULL DEFAULT 0,
  display_order INT DEFAULT 0,
  UNIQUE (menu_item_id, group_id)
);

-- Snapshot of what was actually selected on an order line — survives later
-- edits/removal of the modifier option itself, same principle as item_name/item_price
-- being snapshotted on order_items rather than just referencing menu_items.
CREATE TABLE IF NOT EXISTS order_item_modifiers (
  id                SERIAL PRIMARY KEY,
  order_item_id     INT REFERENCES order_items(id) ON DELETE CASCADE NOT NULL,
  modifier_option_id INT REFERENCES modifier_options(id),
  option_name       TEXT NOT NULL,
  price_delta       NUMERIC(10,2) NOT NULL DEFAULT 0
);

ALTER TABLE modifier_groups            ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_options           ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_modifier_groups  ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_modifiers       ENABLE ROW LEVEL SECURITY;
-- No anon policies: modifiers are read via the server-rendered menu (service_role),
-- and orders are created through the server API routes, not directly from the browser.
