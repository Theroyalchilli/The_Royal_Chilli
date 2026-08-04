-- Module 5: Inventory + Suppliers.

CREATE TABLE IF NOT EXISTS suppliers (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  contact_name  TEXT,
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  notes         TEXT,
  active        INT DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ingredients (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  unit            TEXT NOT NULL, -- e.g. kg, g, l, ml, each
  current_stock   NUMERIC(12,3) NOT NULL DEFAULT 0,
  reorder_level   NUMERIC(12,3) NOT NULL DEFAULT 0,
  reorder_quantity NUMERIC(12,3) DEFAULT 0,
  cost_per_unit   NUMERIC(10,4) NOT NULL DEFAULT 0, -- last known cost, updated on each receipt
  supplier_id     INT REFERENCES suppliers(id),
  active          INT DEFAULT 1,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id             SERIAL PRIMARY KEY,
  order_number   TEXT NOT NULL UNIQUE,
  supplier_id    INT REFERENCES suppliers(id) NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('draft', 'ordered', 'received', 'cancelled')) DEFAULT 'draft',
  order_date     DATE DEFAULT CURRENT_DATE,
  expected_date  DATE,
  received_date  DATE,
  total_cost     NUMERIC(10,2) DEFAULT 0,
  notes          TEXT,
  created_by     INT REFERENCES staff(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                 SERIAL PRIMARY KEY,
  purchase_order_id  INT REFERENCES purchase_orders(id) ON DELETE CASCADE NOT NULL,
  ingredient_id      INT REFERENCES ingredients(id) NOT NULL,
  quantity            NUMERIC(12,3) NOT NULL,
  unit_cost           NUMERIC(10,4) NOT NULL,
  received_quantity   NUMERIC(12,3),
  expiry_date         DATE
);

-- Single ledger for every stock change. quantity_delta is signed: +in, -out.
CREATE TABLE IF NOT EXISTS stock_movements (
  id             SERIAL PRIMARY KEY,
  ingredient_id  INT REFERENCES ingredients(id) NOT NULL,
  movement_type  TEXT NOT NULL CHECK (movement_type IN ('purchase', 'waste', 'adjustment', 'usage')),
  quantity_delta NUMERIC(12,3) NOT NULL,
  reference_type TEXT,
  reference_id   INT,
  reason         TEXT,
  staff_id       INT REFERENCES staff(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Keeps ingredients.current_stock in sync automatically — avoids read-then-write races
-- when multiple movements are recorded concurrently.
CREATE OR REPLACE FUNCTION apply_stock_movement() RETURNS TRIGGER AS $$
BEGIN
  UPDATE ingredients SET current_stock = current_stock + NEW.quantity_delta WHERE id = NEW.ingredient_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_apply_stock_movement ON stock_movements;
CREATE TRIGGER trg_apply_stock_movement AFTER INSERT ON stock_movements
FOR EACH ROW EXECUTE FUNCTION apply_stock_movement();

CREATE TABLE IF NOT EXISTS recipes (
  id            SERIAL PRIMARY KEY,
  menu_item_id  INT REFERENCES menu_items(id),
  name          TEXT NOT NULL,
  yield_quantity NUMERIC(10,2) DEFAULT 1,
  yield_unit    TEXT DEFAULT 'portion',
  notes         TEXT,
  active        INT DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id            SERIAL PRIMARY KEY,
  recipe_id     INT REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
  ingredient_id INT REFERENCES ingredients(id) NOT NULL,
  quantity      NUMERIC(12,3) NOT NULL,
  notes         TEXT
);

ALTER TABLE suppliers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients   ENABLE ROW LEVEL SECURITY;
-- No anon policies: server-only, same as the rest of Staff Hub / POS.
