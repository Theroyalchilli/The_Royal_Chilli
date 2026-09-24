-- Food Safety & Compliance module (attendance app) — Phase 1: data model.
-- Modelled on the FSA's Safer Food, Better Business (SFBB) system: staff log
-- checks by exception, a manager signs the day off, and none of it can be
-- edited or deleted afterwards — that's what makes it a legal due-diligence
-- record rather than just a checklist. See HANDOVER.md §5 for the full spec.
--
-- Shared Supabase project — these tables are used by royal-chilli-attendance,
-- not the POS, same pattern as notifications (033_notifications.sql).

-- Senior employee (e.g. head chef) can be delegated sign-off authority for
-- when the manager is away — a per-person flag, not a new role.
ALTER TABLE staff ADD COLUMN IF NOT EXISTS can_signoff BOOLEAN NOT NULL DEFAULT false;

-- Reuse the POS's existing supplier register rather than a second, competing
-- one — only approved suppliers can be picked when logging a delivery.
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS docs_status TEXT; -- free text: what's on file, e.g. "Food hygiene cert to 2027"

-- Bool checks done at a point in the day (opening/service/closing/weekly) —
-- e.g. "Fridges below 8°C", "Hand-wash sinks stocked". Config-editable by admin.
CREATE TABLE IF NOT EXISTS fs_check_type (
  id             SERIAL PRIMARY KEY,
  check_window   TEXT NOT NULL CHECK (check_window IN ('opening', 'service', 'closing', 'weekly')), -- "window" is a reserved word in Postgres
  label          TEXT NOT NULL,
  rule_text      TEXT,                 -- the "safe method" shown to staff, e.g. FSA SFBB wording
  requires_photo BOOLEAN NOT NULL DEFAULT false,
  active         BOOLEAN NOT NULL DEFAULT true,
  display_order  INT NOT NULL DEFAULT 0
);

-- Numeric temperature checks with a pass rule — SC3 (cooking/cooling/reheat)
-- and SC4 (hot-hold/fridge/freezer) from SFBB.
CREATE TABLE IF NOT EXISTS fs_temp_type (
  id            SERIAL PRIMARY KEY,
  label         TEXT NOT NULL,
  unit          TEXT NOT NULL DEFAULT '°C',
  kind          TEXT NOT NULL CHECK (kind IN ('max', 'min')), -- max = must be at/below limit (fridge); min = must be at/above (hot-hold)
  limit_value   NUMERIC(5,1) NOT NULL,
  rule_text     TEXT,
  active        BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0
);

-- Reporting by exception: staff tick a check off; a failure forces a
-- corrective-action note before it can be saved (enforced in the app).
-- Append-only — see the trigger below.
CREATE TABLE IF NOT EXISTS fs_check_log (
  id            SERIAL PRIMARY KEY,
  check_type_id INT NOT NULL REFERENCES fs_check_type(id),
  staff_id      INT NOT NULL REFERENCES staff(id),
  ok            BOOLEAN NOT NULL,
  problem_note  TEXT,
  photo_ref     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fs_temp_log (
  id                 SERIAL PRIMARY KEY,
  temp_type_id       INT NOT NULL REFERENCES fs_temp_type(id),
  staff_id           INT NOT NULL REFERENCES staff(id),
  value              NUMERIC(5,1) NOT NULL,
  pass               BOOLEAN NOT NULL,
  corrective_action  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A delivery check on arrival — temp taken, accepted or refused. Linked to a
-- purchase order when one exists (POS already has that flow); an unplanned
-- walk-in delivery can still be logged without one.
CREATE TABLE IF NOT EXISTS fs_delivery_check (
  id                 SERIAL PRIMARY KEY,
  supplier_id        INT NOT NULL REFERENCES suppliers(id),
  purchase_order_id  INT REFERENCES purchase_orders(id),
  item               TEXT NOT NULL,
  temp_value         NUMERIC(5,1),
  accepted           BOOLEAN NOT NULL,
  corrective_action  TEXT,
  staff_id           INT NOT NULL REFERENCES staff(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Free-text "something went wrong" log, independent of a specific check —
-- pest sighting, equipment fault, etc.
CREATE TABLE IF NOT EXISTS fs_problem (
  id          SERIAL PRIMARY KEY,
  what        TEXT NOT NULL,
  action      TEXT NOT NULL,
  staff_id    INT NOT NULL REFERENCES staff(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The manager's daily sign-off — THE core legal act this whole module exists
-- to produce. One per day; who can sign is staff.can_signoff plus role.
CREATE TABLE IF NOT EXISTS fs_signoff (
  id          SERIAL PRIMARY KEY,
  day         DATE NOT NULL,
  staff_id    INT NOT NULL REFERENCES staff(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (day)
);

CREATE TABLE IF NOT EXISTS fs_course (
  id             SERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  refresh_months INT NOT NULL DEFAULT 0, -- 0 = one-off, never expires
  has_level      BOOLEAN NOT NULL DEFAULT false -- e.g. Level 1/2/3 food hygiene
);

CREATE TABLE IF NOT EXISTS fs_training_record (
  id          SERIAL PRIMARY KEY,
  staff_id    INT NOT NULL REFERENCES staff(id),
  course_id   INT NOT NULL REFERENCES fs_course(id),
  level       TEXT,
  date_done   DATE NOT NULL,
  trainer     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fs_check_log_type_date ON fs_check_log (check_type_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fs_temp_log_type_date ON fs_temp_log (temp_type_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fs_delivery_check_date ON fs_delivery_check (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fs_training_record_staff ON fs_training_record (staff_id, course_id, date_done DESC);

-- Append-only enforcement, at the database itself rather than just the app —
-- both apps connect with the Supabase service_role key, which bypasses RLS
-- entirely, so an RLS policy would not actually stop this. A trigger is the
-- only layer that can. Corrections are new rows, never edits; nothing —
-- including an admin, including a bug in our own code — can UPDATE or
-- DELETE a posted record.
CREATE OR REPLACE FUNCTION fs_reject_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Food safety records are append-only — % on % is not permitted. Log a correction as a new row instead.', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['fs_check_log', 'fs_temp_log', 'fs_delivery_check', 'fs_problem', 'fs_signoff']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_append_only ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_append_only BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION fs_reject_mutation()',
      t, t
    );
  END LOOP;
END $$;
