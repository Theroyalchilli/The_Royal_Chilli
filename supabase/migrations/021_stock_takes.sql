-- Physical stock-take + variance (closes the gap the inventory ledger can't:
-- does the shelf actually match the system?). Snapshot -> count -> post.
--
-- system_qty is frozen at open time so sales during the count don't move the
-- baseline. Posting writes one 'adjustment' stock_movement per non-zero-variance
-- line (movement_type already allows 'adjustment' — no constraint change needed)
-- so the ledger balance ends up equal to the physical count.

CREATE TABLE IF NOT EXISTS stock_takes (
  id          SERIAL PRIMARY KEY,
  location    TEXT NOT NULL DEFAULT 'all',   -- dry | chiller | freezer | all
  -- 'submitted' sits between count entry and posting: the counting role
  -- submits, then a separate approve_stock_takes-permitted role posts (or
  -- sends it back to 'open' for a recount) — posted_by/posted_at double as
  -- the approval record, so no separate approved_by/approved_at is needed.
  status      TEXT NOT NULL CHECK (status IN ('open', 'submitted', 'posted', 'cancelled')) DEFAULT 'open',
  opened_at   TIMESTAMPTZ DEFAULT NOW(),
  posted_at   TIMESTAMPTZ,
  counted_by  INT REFERENCES staff(id),
  posted_by   INT REFERENCES staff(id)
);

CREATE TABLE IF NOT EXISTS stock_take_lines (
  id             SERIAL PRIMARY KEY,
  stock_take_id  INT REFERENCES stock_takes(id) ON DELETE CASCADE NOT NULL,
  ingredient_id  INT REFERENCES ingredients(id) NOT NULL,
  system_qty     NUMERIC(12,3) NOT NULL,      -- snapshot of current_stock at open time
  counted_qty    NUMERIC(12,3),               -- null until entered
  variance_qty   NUMERIC(12,3) GENERATED ALWAYS AS (counted_qty - system_qty) STORED,
  variance_value NUMERIC(10,2),               -- variance_qty * cost_per_unit, set on post
  reason_code    TEXT CHECK (reason_code IN ('waste', 'spoilage', 'over_portion', 'unknown', 'count_error')),
  UNIQUE (stock_take_id, ingredient_id)
);

ALTER TABLE stock_takes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_take_lines ENABLE ROW LEVEL SECURITY;
-- No anon policies: server-only, same as the rest of the inventory module.

-- Belt-and-braces: CREATE TABLE IF NOT EXISTS above is a no-op when
-- stock_takes already exists (e.g. an earlier partial run of this file), so
-- the 'submitted' status wouldn't reach an already-deployed DB without this
-- explicit widening. Safe to run even when the constraint is already correct.
ALTER TABLE stock_takes DROP CONSTRAINT IF EXISTS stock_takes_status_check;
ALTER TABLE stock_takes ADD CONSTRAINT stock_takes_status_check
  CHECK (status IN ('open', 'submitted', 'posted', 'cancelled'));

-- New permission gating the submitted -> posted step (separate from
-- manage_inventory, which covers open/count/submit). Seeded the same way
-- schema.sql seeds every other permission, so an already-deployed DB picks
-- this up when the migration runs.
INSERT INTO role_permissions (role, permission, granted)
SELECT r.role, 'approve_stock_takes', false
FROM unnest(ARRAY['owner','admin','manager','supervisor','cashier','waiter','chef','kitchen','driver','inventory_manager','accountant','employee']) AS r(role)
ON CONFLICT (role, permission) DO NOTHING;

UPDATE role_permissions SET granted = true WHERE permission = 'approve_stock_takes' AND role IN ('owner','admin','manager');
