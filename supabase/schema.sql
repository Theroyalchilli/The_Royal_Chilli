-- Royal Chilli POS - Supabase PostgreSQL Schema
-- Paste this entire file into the Supabase SQL Editor and run it.

-- =====================
-- DROP TABLES (clean slate)
-- =====================
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS stock_take_lines CASCADE;
DROP TABLE IF EXISTS stock_takes CASCADE;
DROP TABLE IF EXISTS order_item_modifiers CASCADE;
DROP TABLE IF EXISTS menu_item_modifier_groups CASCADE;
DROP TABLE IF EXISTS modifier_options CASCADE;
DROP TABLE IF EXISTS modifier_groups CASCADE;
DROP TABLE IF EXISTS supplier_payments CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS loyalty_transactions CASCADE;
DROP TABLE IF EXISTS loyalty_rewards CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS recipe_ingredients CASCADE;
DROP TABLE IF EXISTS recipes CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS purchase_order_items CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS ingredients CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS staff_onboarding_tasks CASCADE;
DROP TABLE IF EXISTS staff_rtw_verification CASCADE;
DROP TABLE IF EXISTS staff_references CASCADE;
DROP TABLE IF EXISTS staff_hr_details CASCADE;
DROP TABLE IF EXISTS staff_availability CASCADE;
DROP TABLE IF EXISTS table_requests CASCADE;
DROP TABLE IF EXISTS app_settings CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS payroll_payments CASCADE;
DROP TABLE IF EXISTS payroll_entries CASCADE;
DROP TABLE IF EXISTS payroll_periods CASCADE;
DROP TABLE IF EXISTS leave_requests CASCADE;
DROP TABLE IF EXISTS breaks CASCADE;
DROP TABLE IF EXISTS clock_events CASCADE;
DROP TABLE IF EXISTS shifts CASCADE;
DROP TABLE IF EXISTS reservations CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS print_jobs CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS delivery_zones CASCADE;
DROP TABLE IF EXISTS work_periods CASCADE;
DROP TABLE IF EXISTS restaurant_tables CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS menu_categories CASCADE;
DROP TABLE IF EXISTS staff CASCADE;

-- =====================
-- TABLES
-- =====================

CREATE TABLE staff (
  id                      SERIAL PRIMARY KEY,
  name                    TEXT NOT NULL,
  pin_hash                TEXT,
  username                TEXT UNIQUE,
  password_hash           TEXT,
  role                    TEXT NOT NULL CHECK (role IN (
                            'owner','admin','manager','supervisor','cashier','waiter','chef','kitchen',
                            'driver','inventory_manager','accountant','employee'
                          )) DEFAULT 'employee',
  active                  INT DEFAULT 1,
  employee_number         TEXT UNIQUE,
  email                   TEXT,
  phone                   TEXT,
  address                 TEXT,
  date_of_birth           DATE,
  hire_date               DATE DEFAULT CURRENT_DATE,
  employment_type         TEXT CHECK (employment_type IN ('hourly', 'salaried')) DEFAULT 'hourly',
  pay_rate                NUMERIC(10,2) DEFAULT 0,
  pay_frequency           TEXT CHECK (pay_frequency IN ('weekly', 'monthly')) DEFAULT 'weekly',
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  notes                   TEXT,
  vehicle_type            TEXT,
  vehicle_registration    TEXT,
  driver_status           TEXT CHECK (driver_status IN ('available', 'on_delivery', 'offline')),
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Customers: linked to orders/reservations by phone number once we know it
-- (website checkout, reservation, or a POS order where staff entered a phone).
CREATE TABLE customers (
  id                      SERIAL PRIMARY KEY,
  name                    TEXT NOT NULL,
  phone                   TEXT UNIQUE, -- nullable: an email-signup account may not have one yet
  email                   TEXT,
  date_of_birth           DATE,
  address                 TEXT,
  notes                   TEXT,
  loyalty_points          INT NOT NULL DEFAULT 0,
  referral_code           TEXT UNIQUE,
  referred_by_customer_id INT REFERENCES customers(id),
  referral_completed_at   TIMESTAMPTZ,
  marketing_consent       BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash           TEXT, -- self-service customer account; NULL for phone-only guest rows
  created_at              TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX customers_email_account_unique ON customers (lower(email)) WHERE password_hash IS NOT NULL;

CREATE TABLE menu_categories (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  display_order INT DEFAULT 0,
  color         TEXT DEFAULT '#f97316',
  active        INT DEFAULT 1
);

CREATE TABLE menu_items (
  id            SERIAL PRIMARY KEY,
  category_id   INT REFERENCES menu_categories(id),
  name          TEXT NOT NULL,
  description   TEXT,
  price         NUMERIC(10,2) NOT NULL,
  is_veg        INT DEFAULT 0,
  active        INT DEFAULT 1,
  display_order INT DEFAULT 0,
  allergens     TEXT[] DEFAULT '{}', -- 14 UK/EU legally-recognised allergen categories
  calories      INT,
  protein_g     NUMERIC(6,1),
  carbs_g       NUMERIC(6,1),
  fat_g         NUMERIC(6,1)
);

CREATE TABLE restaurant_tables (
  id                  SERIAL PRIMARY KEY,
  table_number        TEXT NOT NULL,
  capacity            INT DEFAULT 4,
  status              TEXT CHECK (status IN ('available','occupied','reserved')) DEFAULT 'available',
  location            TEXT CHECK (location IN ('main','outdoor','private')) DEFAULT 'main',
  self_order_enabled  BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE work_periods (
  id            SERIAL PRIMARY KEY,
  opened_by     INT REFERENCES staff(id),
  closed_by     INT REFERENCES staff(id),
  opened_at     TIMESTAMPTZ DEFAULT NOW(),
  closed_at     TIMESTAMPTZ,
  opening_cash  NUMERIC(10,2) DEFAULT 0,
  closing_cash  NUMERIC(10,2),
  status        TEXT CHECK (status IN ('open','closed')) DEFAULT 'open'
);

-- Matched by UK postcode outward code (e.g. "TW3" from "TW3 1PA").
CREATE TABLE delivery_zones (
  id                SERIAL PRIMARY KEY,
  name              TEXT NOT NULL,
  postcode_prefixes TEXT[] NOT NULL DEFAULT '{}',
  fee               NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_order         NUMERIC(10,2) NOT NULL DEFAULT 0,
  active            INT NOT NULL DEFAULT 1,
  display_order     INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE orders (
  id               SERIAL PRIMARY KEY,
  order_number     TEXT NOT NULL UNIQUE,
  order_type       TEXT NOT NULL CHECK (order_type IN ('dine_in','takeaway','delivery','online')),
  table_id         INT REFERENCES restaurant_tables(id),
  customer_id      INT REFERENCES customers(id),
  customer_name    TEXT,
  customer_phone   TEXT,
  customer_address TEXT,
  customer_postcode TEXT,
  customer_email    TEXT,
  stripe_session_id TEXT,
  sumup_checkout_id TEXT,
  delivery_zone_id INT REFERENCES delivery_zones(id),
  status           TEXT CHECK (status IN ('open','sent_to_kitchen','ready','paid','cancelled')) DEFAULT 'open',
  staff_id         INT REFERENCES staff(id),
  driver_id        INT REFERENCES staff(id),
  delivery_status  TEXT CHECK (delivery_status IN ('unassigned', 'assigned', 'out_for_delivery', 'delivered')) DEFAULT 'unassigned',
  scheduled_for    TIMESTAMPTZ, -- requested pickup/delivery time; null = ASAP
  work_period_id   INT REFERENCES work_periods(id),
  subtotal         NUMERIC(10,2) DEFAULT 0,
  discount         NUMERIC(10,2) DEFAULT 0, -- resolved flat amount; kept in sync from discount_type/discount_pct
  discount_reason  TEXT,
  discount_type    TEXT CHECK (discount_type IN ('percent', 'amount')),
  discount_pct     NUMERIC(5,2) CHECK (discount_pct >= 0 AND discount_pct <= 100),
  service_charge_pct    NUMERIC(5,2) NOT NULL DEFAULT 0,
  service_charge_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_paid      NUMERIC(10,2) NOT NULL DEFAULT 0, -- running total from payments, via trigger
  tax              NUMERIC(10,2) DEFAULT 0,
  total            NUMERIC(10,2) DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
  id                SERIAL PRIMARY KEY,
  order_id          INT REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id      INT REFERENCES menu_items(id),
  item_name         TEXT NOT NULL,
  item_price        NUMERIC(10,2) NOT NULL,
  quantity          INT DEFAULT 1,
  original_quantity INT,
  notes             TEXT,
  status            TEXT CHECK (status IN ('pending','preparing','ready','cancelled')) DEFAULT 'pending',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Queue of tickets waiting to be picked up by the reception printer (Star
-- mC-Print3) via Star's CloudPRNT protocol — see app/api/cloudprnt.
CREATE TABLE print_jobs (
  id          SERIAL PRIMARY KEY,
  order_id    INT REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  printed_at  TIMESTAMPTZ
);

CREATE TABLE payments (
  id           SERIAL PRIMARY KEY,
  order_id     INT REFERENCES orders(id),
  method       TEXT NOT NULL CHECK (method IN ('cash','card','card_online')),
  amount       NUMERIC(10,2) NOT NULL,
  tip_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  change_given NUMERIC(10,2) DEFAULT 0,
  reference    TEXT,
  staff_id     INT REFERENCES staff(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Keeps orders.amount_paid in sync — same audit-trail-with-trigger pattern as
-- stock_movements/loyalty_transactions, so split/partial payments accumulate correctly.
CREATE OR REPLACE FUNCTION apply_payment_to_order() RETURNS TRIGGER AS $$
BEGIN
  UPDATE orders SET amount_paid = amount_paid + NEW.amount WHERE id = NEW.order_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_apply_payment_to_order AFTER INSERT ON payments
FOR EACH ROW EXECUTE FUNCTION apply_payment_to_order();

CREATE TABLE reservations (
  id               SERIAL PRIMARY KEY,
  customer_id      INT REFERENCES customers(id),
  customer_name    TEXT NOT NULL,
  customer_phone   TEXT,
  customer_email   TEXT,
  party_size       INT DEFAULT 2,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  table_id         INT REFERENCES restaurant_tables(id),
  status           TEXT CHECK (status IN ('pending','confirmed','seated','cancelled','no_show','waitlisted')) DEFAULT 'pending',
  notes            TEXT,
  source           TEXT DEFAULT 'website',
  deposit_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  deposit_paid_at  TIMESTAMPTZ,
  stripe_session_id TEXT,
  sumup_checkout_id TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- QR dine-in: guests at a table tap "Call Waiter" / "Request Bill".
-- Only the server (service_role) reads/writes this — no anon policies needed.
CREATE TABLE table_requests (
  id          SERIAL PRIMARY KEY,
  table_id    INT REFERENCES restaurant_tables(id) NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('waiter', 'bill')),
  status      TEXT NOT NULL CHECK (status IN ('pending', 'resolved')) DEFAULT 'pending',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- =====================
-- STAFF HUB
-- =====================

CREATE TABLE shifts (
  id          SERIAL PRIMARY KEY,
  staff_id    INT REFERENCES staff(id) NOT NULL,
  shift_date  DATE NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  position    TEXT,
  status      TEXT NOT NULL CHECK (status IN ('scheduled', 'completed', 'missed', 'cancelled')) DEFAULT 'scheduled',
  notes       TEXT,
  created_by  INT REFERENCES staff(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Full timestamps (not just TIME) so overnight shifts spanning midnight work naturally.
CREATE TABLE clock_events (
  id                  SERIAL PRIMARY KEY,
  staff_id            INT REFERENCES staff(id) NOT NULL,
  shift_id            INT REFERENCES shifts(id),
  clock_in            TIMESTAMPTZ NOT NULL,
  clock_out           TIMESTAMPTZ,
  status              TEXT NOT NULL CHECK (status IN ('open', 'closed')) DEFAULT 'open',
  late_minutes        INT DEFAULT 0,
  notes               TEXT,
  correction_status   TEXT NOT NULL CHECK (correction_status IN ('none', 'pending', 'approved', 'rejected')) DEFAULT 'none',
  correction_reason   TEXT,
  requested_clock_in  TIMESTAMPTZ,
  requested_clock_out TIMESTAMPTZ,
  approved_by         INT REFERENCES staff(id),
  approved_at         TIMESTAMPTZ,
  -- Geofencing: location captured on both clock-in and clock-out, but only
  -- clock-in is ever blocked by it. clocked_in_by_manager records a manager
  -- override (GPS trouble etc.) — location fields don't apply on those rows.
  clock_in_latitude    NUMERIC(9,6),
  clock_in_longitude   NUMERIC(9,6),
  clock_in_distance_m  NUMERIC(9,1),
  clock_out_latitude   NUMERIC(9,6),
  clock_out_longitude  NUMERIC(9,6),
  clock_out_distance_m NUMERIC(9,1),
  clocked_in_by_manager INT REFERENCES staff(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE breaks (
  id              SERIAL PRIMARY KEY,
  clock_event_id  INT REFERENCES clock_events(id) ON DELETE CASCADE NOT NULL,
  break_start     TIMESTAMPTZ NOT NULL,
  break_end       TIMESTAMPTZ
);

CREATE TABLE leave_requests (
  id          SERIAL PRIMARY KEY,
  staff_id    INT REFERENCES staff(id) NOT NULL,
  leave_type  TEXT NOT NULL CHECK (leave_type IN ('holiday', 'sick', 'unpaid', 'other')),
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  reason      TEXT,
  status      TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  decided_by  INT REFERENCES staff(id),
  decided_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payroll_periods (
  id           SERIAL PRIMARY KEY,
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('open', 'processing', 'closed')) DEFAULT 'open',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (period_start, period_end)
);

-- Simplified formula per owner's decision: gross_pay = hours_worked * pay_rate + bonuses + tips - deductions.
-- No overtime multiplier. holiday_pay is entered manually (no auto rolled-up % calculation for now).
CREATE TABLE payroll_entries (
  id                SERIAL PRIMARY KEY,
  payroll_period_id INT REFERENCES payroll_periods(id) NOT NULL,
  staff_id          INT REFERENCES staff(id) NOT NULL,
  hours_worked      NUMERIC(6,2) DEFAULT 0,
  pay_rate          NUMERIC(10,2) DEFAULT 0,
  base_pay          NUMERIC(10,2) DEFAULT 0,
  bonuses           NUMERIC(10,2) DEFAULT 0,
  tips              NUMERIC(10,2) DEFAULT 0,
  deductions        NUMERIC(10,2) DEFAULT 0,
  holiday_pay       NUMERIC(10,2) DEFAULT 0,
  gross_pay         NUMERIC(10,2) DEFAULT 0,
  paid_amount       NUMERIC(10,2) DEFAULT 0,
  status            TEXT NOT NULL CHECK (status IN ('pending', 'partially_paid', 'paid')) DEFAULT 'pending',
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (payroll_period_id, staff_id)
);

CREATE TABLE payroll_payments (
  id                SERIAL PRIMARY KEY,
  payroll_entry_id  INT REFERENCES payroll_entries(id) NOT NULL,
  amount            NUMERIC(10,2) NOT NULL,
  method            TEXT,
  paid_at           TIMESTAMPTZ DEFAULT NOW(),
  recorded_by       INT REFERENCES staff(id),
  notes             TEXT
);

-- Platform-wide audit log (shared across every module per the "one platform" requirement).
CREATE TABLE audit_logs (
  id          SERIAL PRIMARY KEY,
  staff_id    INT REFERENCES staff(id),
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   INT,
  changes     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE app_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Configurable Roles & Permissions: owner/admin edit this matrix from Settings
-- instead of the checks being hardcoded arrays in lib/permissions.ts.
CREATE TABLE role_permissions (
  role        TEXT NOT NULL,
  permission  TEXT NOT NULL,
  granted     BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (role, permission)
);

-- Recurring weekly availability. day_of_week matches JS Date.getDay(): 0=Sunday .. 6=Saturday.
CREATE TABLE staff_availability (
  id            SERIAL PRIMARY KEY,
  staff_id      INT REFERENCES staff(id) NOT NULL,
  day_of_week   INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_available  INT NOT NULL DEFAULT 1,
  notes         TEXT,
  UNIQUE (staff_id, day_of_week)
);

-- =====================
-- HR: ONBOARDING, RIGHT TO WORK, NEW STARTER CHECKLIST
-- Kept as separate tables from staff rather than more columns on it: staff
-- is queried constantly (auth, orders, rota) and most of this is sensitive
-- and only ever needed on the one HR screen.
-- =====================

CREATE TABLE staff_hr_details (
  id                              SERIAL PRIMARY KEY,
  staff_id                        INT UNIQUE REFERENCES staff(id) ON DELETE CASCADE NOT NULL,
  preferred_name                  TEXT,
  job_title                       TEXT,
  department                      TEXT,
  employment_status               TEXT CHECK (employment_status IN ('employee', 'worker')),
  contract_type                   TEXT CHECK (contract_type IN ('permanent', 'fixed_term', 'zero_hours', 'temporary')),
  working_pattern                 TEXT CHECK (working_pattern IN ('full_time', 'part_time', 'variable')),
  fixed_term_end_date             DATE,
  contracted_hours_per_week       TEXT, -- free text: template allows a number or "variable"

  -- Self-declared right-to-work info (employee's onboarding form answers,
  -- distinct from the employer's own verification in staff_rtw_verification)
  rtw_evidence_method              TEXT,
  rtw_share_code                   TEXT,
  rtw_time_limited                 TEXT CHECK (rtw_time_limited IN ('yes', 'no', 'unsure')),
  rtw_permission_expiry_date       DATE,
  rtw_has_restrictions             TEXT CHECK (rtw_has_restrictions IN ('yes', 'no', 'unsure')),
  rtw_restrictions_details         TEXT,
  rtw_is_student                   TEXT CHECK (rtw_is_student IN ('yes', 'no')),
  rtw_student_dates_provided       BOOLEAN DEFAULT false,
  rtw_sponsorship_now              TEXT CHECK (rtw_sponsorship_now IN ('yes', 'no', 'unsure')),
  rtw_sponsorship_future           TEXT CHECK (rtw_sponsorship_future IN ('yes', 'no', 'unsure')),

  -- Payroll / bank — sensitive; ni_number, sort_code and account_number are
  -- masked in every API response except the explicit, audit-logged reveal.
  ni_number                        TEXT,
  p45_available                    TEXT CHECK (p45_available IN ('yes', 'no', 'not_applicable')),
  hmrc_starter_checklist           TEXT CHECK (hmrc_starter_checklist IN ('yes', 'no', 'not_applicable')),
  bank_account_name                TEXT,
  bank_name                        TEXT,
  sort_code                        TEXT,
  account_number                   TEXT,

  emergency_contact_relationship   TEXT,
  emergency_contact_email          TEXT,

  reasonable_adjustment_needed     TEXT CHECK (reasonable_adjustment_needed IN ('yes', 'no', 'prefer_to_discuss')),
  reasonable_adjustment_details    TEXT,

  doc_id_rtw_supplied              BOOLEAN DEFAULT false,
  doc_p45_or_starter_supplied      BOOLEAN DEFAULT false,
  doc_quals_supplied               BOOLEAN DEFAULT false,
  doc_bank_supplied                BOOLEAN DEFAULT false,
  doc_other                        TEXT,

  declaration_confirmed_accurate   BOOLEAN DEFAULT false,
  declaration_will_report_changes  BOOLEAN DEFAULT false,
  declaration_read_privacy         BOOLEAN DEFAULT false,
  declaration_signature            TEXT,
  declaration_date                 DATE,

  updated_at                       TIMESTAMPTZ DEFAULT NOW(),
  created_at                       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE staff_references (
  id               SERIAL PRIMARY KEY,
  staff_id         INT REFERENCES staff(id) ON DELETE CASCADE NOT NULL,
  employer_name    TEXT,
  job_title        TEXT,
  employment_dates TEXT,
  referee_name     TEXT,
  referee_contact  TEXT,
  may_contact      BOOLEAN,
  qualification    TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- The employer's own signed-off check — kept as a history (one row per
-- check, including follow-up checks on time-limited permission) rather than
-- an editable single record, since this is the legal statutory-excuse trail.
CREATE TABLE staff_rtw_verification (
  id                              SERIAL PRIMARY KEY,
  staff_id                        INT REFERENCES staff(id) ON DELETE CASCADE NOT NULL,
  check_date                      DATE NOT NULL,
  check_method                    TEXT NOT NULL CHECK (check_method IN ('manual', 'home_office_online', 'idvt', 'employer_checking_service')),
  identity_matched                BOOLEAN,
  documents_genuine_valid         BOOLEAN,
  work_permitted                  BOOLEAN,
  time_limited                    BOOLEAN,
  permission_expiry_date          DATE,
  follow_up_due_date              DATE,
  student_dates_retained          TEXT CHECK (student_dates_retained IN ('yes', 'no', 'not_applicable')),
  ecs_expiry_date                 DATE,
  evidence_stored_securely        BOOLEAN DEFAULT false,
  storage_location                TEXT,
  retention_reminder_recorded     BOOLEAN DEFAULT false,
  restrictions_communicated       TEXT CHECK (restrictions_communicated IN ('yes', 'no', 'not_applicable')),
  document_reference              TEXT,
  checked_by                      INT REFERENCES staff(id) NOT NULL,
  checked_by_position             TEXT,
  employer_declaration_confirmed  BOOLEAN DEFAULT false,
  signed_by                       TEXT,
  signed_date                     DATE,
  created_at                      TIMESTAMPTZ DEFAULT NOW()
);

-- Fixed 16-task checklist (see lib/hr.ts ONBOARDING_TASKS) — rows are
-- created lazily per staff member the first time their checklist is opened.
CREATE TABLE staff_onboarding_tasks (
  id            SERIAL PRIMARY KEY,
  staff_id      INT REFERENCES staff(id) ON DELETE CASCADE NOT NULL,
  task_key      TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('not_started', 'done')) DEFAULT 'not_started',
  notes         TEXT,
  completed_at  TIMESTAMPTZ,
  completed_by  INT REFERENCES staff(id),
  UNIQUE (staff_id, task_key)
);

-- =====================
-- INVENTORY + SUPPLIERS
-- =====================

CREATE TABLE suppliers (
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

CREATE TABLE ingredients (
  id               SERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  unit             TEXT NOT NULL,
  current_stock    NUMERIC(12,3) NOT NULL DEFAULT 0,
  reorder_level    NUMERIC(12,3) NOT NULL DEFAULT 0,
  reorder_quantity NUMERIC(12,3) DEFAULT 0,
  cost_per_unit    NUMERIC(10,4) NOT NULL DEFAULT 0,
  supplier_id      INT REFERENCES suppliers(id),
  active           INT DEFAULT 1,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchase_orders (
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

CREATE TABLE purchase_order_items (
  id                 SERIAL PRIMARY KEY,
  purchase_order_id  INT REFERENCES purchase_orders(id) ON DELETE CASCADE NOT NULL,
  ingredient_id      INT REFERENCES ingredients(id) NOT NULL,
  quantity           NUMERIC(12,3) NOT NULL,
  unit_cost          NUMERIC(10,4) NOT NULL,
  received_quantity  NUMERIC(12,3),
  expiry_date        DATE
);

-- Single ledger for every stock change. quantity_delta is signed: +in, -out.
CREATE TABLE stock_movements (
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

CREATE OR REPLACE FUNCTION apply_stock_movement() RETURNS TRIGGER AS $$
BEGIN
  UPDATE ingredients SET current_stock = current_stock + NEW.quantity_delta WHERE id = NEW.ingredient_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_apply_stock_movement AFTER INSERT ON stock_movements
FOR EACH ROW EXECUTE FUNCTION apply_stock_movement();

CREATE TABLE recipes (
  id             SERIAL PRIMARY KEY,
  menu_item_id   INT REFERENCES menu_items(id),
  name           TEXT NOT NULL,
  yield_quantity NUMERIC(10,2) DEFAULT 1,
  yield_unit     TEXT DEFAULT 'portion',
  notes          TEXT,
  active         INT DEFAULT 1,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE recipe_ingredients (
  id            SERIAL PRIMARY KEY,
  recipe_id     INT REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
  ingredient_id INT REFERENCES ingredients(id) NOT NULL,
  quantity      NUMERIC(12,3) NOT NULL,
  notes         TEXT
);

-- Physical stock-take + variance. system_qty is frozen at open time so sales
-- during the count don't move the baseline; posting writes an 'adjustment'
-- stock_movement per non-zero-variance line.
CREATE TABLE stock_takes (
  id          SERIAL PRIMARY KEY,
  location    TEXT NOT NULL DEFAULT 'all',
  -- 'submitted' sits between count entry and posting: the counting role
  -- submits, a separate approve_stock_takes-permitted role posts (or sends
  -- it back to 'open') — posted_by/posted_at double as the approval record.
  status      TEXT NOT NULL CHECK (status IN ('open', 'submitted', 'posted', 'cancelled')) DEFAULT 'open',
  opened_at   TIMESTAMPTZ DEFAULT NOW(),
  posted_at   TIMESTAMPTZ,
  counted_by  INT REFERENCES staff(id),
  posted_by   INT REFERENCES staff(id)
);

CREATE TABLE stock_take_lines (
  id             SERIAL PRIMARY KEY,
  stock_take_id  INT REFERENCES stock_takes(id) ON DELETE CASCADE NOT NULL,
  ingredient_id  INT REFERENCES ingredients(id) NOT NULL,
  system_qty     NUMERIC(12,3) NOT NULL,
  counted_qty    NUMERIC(12,3),
  variance_qty   NUMERIC(12,3) GENERATED ALWAYS AS (counted_qty - system_qty) STORED,
  variance_value NUMERIC(10,2),
  reason_code    TEXT CHECK (reason_code IN ('waste', 'spoilage', 'over_portion', 'unknown', 'count_error')),
  UNIQUE (stock_take_id, ingredient_id)
);

-- =====================
-- LOYALTY
-- =====================

CREATE TABLE loyalty_tiers (
  id                  SERIAL PRIMARY KEY,
  name                TEXT NOT NULL UNIQUE,
  min_lifetime_spend  NUMERIC(10,2) NOT NULL DEFAULT 0,
  points_multiplier   NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  sort_order          INT NOT NULL DEFAULT 0,
  active              INT NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO loyalty_tiers (name, min_lifetime_spend, points_multiplier, sort_order) VALUES
  ('Bronze', 0,   1.0,  0),
  ('Silver', 200, 1.25, 1),
  ('Gold',   500, 1.5,  2);

-- A tier change is itself an event worth a record, separate from the points
-- ledger since it carries no points_delta of its own.
CREATE TABLE loyalty_tier_changes (
  id                       SERIAL PRIMARY KEY,
  customer_id              INT REFERENCES customers(id) NOT NULL,
  from_tier_id             INT REFERENCES loyalty_tiers(id),
  to_tier_id               INT REFERENCES loyalty_tiers(id) NOT NULL,
  lifetime_spend_at_change NUMERIC(10,2) NOT NULL,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

-- Points ledger — same audit-trail pattern as stock_movements. A trigger keeps
-- customers.loyalty_points in sync so there's no read-then-write race.
CREATE TABLE loyalty_transactions (
  id             SERIAL PRIMARY KEY,
  customer_id    INT REFERENCES customers(id) NOT NULL,
  points_delta   INT NOT NULL,
  reason         TEXT NOT NULL CHECK (reason IN ('earned_purchase', 'tier_bonus', 'redeemed_reward', 'birthday_bonus', 'referral_bonus', 'manual_adjustment', 'points_expired', 'refund_reversal', 'welcome_bonus', 'redemption_cancelled')),
  reference_type TEXT,
  reference_id   INT,
  staff_id       INT REFERENCES staff(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION apply_loyalty_transaction() RETURNS TRIGGER AS $$
BEGIN
  UPDATE customers SET loyalty_points = loyalty_points + NEW.points_delta WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_apply_loyalty_transaction AFTER INSERT ON loyalty_transactions
FOR EACH ROW EXECUTE FUNCTION apply_loyalty_transaction();

CREATE TABLE loyalty_rewards (
  id                 SERIAL PRIMARY KEY,
  name               TEXT NOT NULL,
  description        TEXT,
  points_cost        INT NOT NULL,
  active             INT DEFAULT 1,
  discount_amount    NUMERIC(10,2),
  min_spend          NUMERIC(10,2) NOT NULL DEFAULT 0,
  eligible_tier_id   INT REFERENCES loyalty_tiers(id),
  valid_days         INT NOT NULL DEFAULT 7,
  per_customer_limit INT,
  start_date         DATE,
  end_date           DATE,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Issued (points debited, code generated) then later redeemed (code entered
-- at POS, applied to a specific order) — two steps, so "redeem" can be
-- validated/audited independently of "issue".
CREATE TABLE loyalty_redemptions (
  id                   SERIAL PRIMARY KEY,
  code                 TEXT NOT NULL UNIQUE,
  customer_id          INT REFERENCES customers(id) NOT NULL,
  reward_id            INT REFERENCES loyalty_rewards(id) NOT NULL,
  points_spent         INT NOT NULL,
  status               TEXT NOT NULL CHECK (status IN ('issued', 'redeemed', 'expired', 'cancelled')) DEFAULT 'issued',
  issued_at            TIMESTAMPTZ DEFAULT NOW(),
  issued_by_staff_id   INT REFERENCES staff(id),
  expires_at           TIMESTAMPTZ NOT NULL,
  redeemed_at          TIMESTAMPTZ,
  redeemed_by_staff_id INT REFERENCES staff(id),
  redeemed_order_id    INT REFERENCES orders(id)
);
CREATE INDEX idx_loyalty_redemptions_customer ON loyalty_redemptions(customer_id);

CREATE TABLE customer_addresses (
  id          SERIAL PRIMARY KEY,
  customer_id INT REFERENCES customers(id) NOT NULL,
  label       TEXT NOT NULL DEFAULT 'Home',
  line        TEXT NOT NULL,
  postcode    TEXT,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_customer_addresses_customer ON customer_addresses(customer_id);

-- Public-site newsletter capture — separate from customers since most
-- subscribers are anonymous visitors, not account holders.
CREATE TABLE newsletter_subscribers (
  id         BIGSERIAL PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Single-active-promotion model for the site's promo strip banner.
CREATE TABLE promotions (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  link_url    TEXT,
  active      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- FINANCE
-- =====================

CREATE TABLE expenses (
  id                SERIAL PRIMARY KEY,
  category          TEXT NOT NULL CHECK (category IN ('rent', 'utilities', 'marketing', 'equipment', 'professional_fees', 'other')),
  description       TEXT NOT NULL,
  amount            NUMERIC(10,2) NOT NULL,
  vat_applicable    INT NOT NULL DEFAULT 1,
  expense_date      DATE DEFAULT CURRENT_DATE,
  receipt_reference TEXT,
  recorded_by       INT REFERENCES staff(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE supplier_payments (
  id                 SERIAL PRIMARY KEY,
  supplier_id        INT REFERENCES suppliers(id) NOT NULL,
  purchase_order_id  INT REFERENCES purchase_orders(id),
  amount             NUMERIC(10,2) NOT NULL,
  method             TEXT,
  paid_at            TIMESTAMPTZ DEFAULT NOW(),
  recorded_by        INT REFERENCES staff(id),
  notes              TEXT
);

-- =====================
-- MODIFIERS (spice level, extras, etc.)
-- =====================

CREATE TABLE modifier_groups (
  id             SERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  selection_type TEXT NOT NULL CHECK (selection_type IN ('single', 'multiple')) DEFAULT 'single',
  min_select     INT NOT NULL DEFAULT 0,
  max_select     INT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE modifier_options (
  id            SERIAL PRIMARY KEY,
  group_id      INT REFERENCES modifier_groups(id) ON DELETE CASCADE NOT NULL,
  name          TEXT NOT NULL,
  price_delta   NUMERIC(10,2) NOT NULL DEFAULT 0,
  display_order INT DEFAULT 0
);

CREATE TABLE menu_item_modifier_groups (
  id            SERIAL PRIMARY KEY,
  menu_item_id  INT REFERENCES menu_items(id) ON DELETE CASCADE NOT NULL,
  group_id      INT REFERENCES modifier_groups(id) ON DELETE CASCADE NOT NULL,
  required      INT NOT NULL DEFAULT 0,
  display_order INT DEFAULT 0,
  UNIQUE (menu_item_id, group_id)
);

CREATE TABLE order_item_modifiers (
  id                 SERIAL PRIMARY KEY,
  order_item_id      INT REFERENCES order_items(id) ON DELETE CASCADE NOT NULL,
  modifier_option_id INT REFERENCES modifier_options(id),
  option_name        TEXT NOT NULL,
  price_delta        NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- =====================
-- ROW LEVEL SECURITY
-- POS server code uses the service_role key (bypasses RLS).
-- The public website uses the anon key directly from the browser, so it
-- only gets the minimum access below. See migrations/001_enable_rls.sql
-- for the full rationale.
-- =====================
ALTER TABLE staff              ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables  ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_periods       ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_jobs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_zones     ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE clock_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE breaks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_periods    ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_entries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_payments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_hr_details       ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_references       ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_rtw_verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_onboarding_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients   ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_takes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_take_lines     ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rewards      ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_payments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_groups           ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_options          ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_modifiers      ENABLE ROW LEVEL SECURITY;

CREATE POLICY anon_read_active_menu_categories ON menu_categories
  FOR SELECT TO anon USING (active = 1);
CREATE POLICY anon_read_active_menu_items ON menu_items
  FOR SELECT TO anon USING (active = 1);
CREATE POLICY anon_insert_orders ON orders
  FOR INSERT TO anon WITH CHECK (order_type = 'online');
CREATE POLICY anon_insert_order_items ON order_items
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_insert_reservations ON reservations
  FOR INSERT TO anon WITH CHECK (source = 'website');

-- =====================
-- SEED: Default Staff (dev only — change these passwords after first login)
-- admin/Admin123!, manager/Manager123!, cashier/Cashier123!, kitchen/Kitchen123!
-- Hashes generated and verified with bcryptjs (10 rounds) against the exact password.
-- =====================
INSERT INTO staff (name, username, password_hash, role, active, employee_number) VALUES
  ('Admin', 'admin', '$2b$10$xoYn2RzcxhbOV6.nk6g7YeaBN0see.o.3Lrjs.eavItkN99kH6ram', 'owner', 1, 'RC-EMP-0001'),
  ('Manager', 'manager', '$2b$10$/VXUUlO2tKqLXS5gZguYE.7AWJdPJi38JSU/1nMpOGcSrtJH3KYja', 'manager', 1, 'RC-EMP-0002'),
  ('Cashier', 'cashier', '$2b$10$0KuuEh0tpHYALTAN3olWHey6oZk6rbbtv6fJTUfzQD/zOqKR3WxWu', 'cashier', 1, 'RC-EMP-0003'),
  ('Kitchen', 'kitchen', '$2b$10$9nk3GndZF9yZdcSPVOfhDetDexvVciTVjYYj4Vvlc0WC13LLJi9JK', 'kitchen', 1, 'RC-EMP-0004');

-- =====================
-- SEED: App Settings
-- =====================
INSERT INTO app_settings (key, value) VALUES
  ('company_name', '"The Royal Chilli"'),
  ('currency', '"GBP"'),
  ('week_start_day', '"Monday"'),
  ('overtime_enabled', 'false'),
  ('vat_rate', '0.2'),
  ('max_employees', '20'),
  ('reservation_deposit_amount', '0'),
  ('stripe_terminal_reader_id', '""'),
  ('geofence_enabled', 'false'),
  ('restaurant_latitude', 'null'),
  ('restaurant_longitude', 'null'),
  ('geofence_radius_meters', '150'),
  ('hero_content', '{
    "tag": "Authentic Flavours. Memorable Experiences.",
    "headline": "Authentic Indian Flavours.",
    "headlineGold": "Made to Be Remembered.",
    "description": "Discover authentic Hyderabadi, South Indian and North Indian cuisine, from signature dum biryanis and regional curries to dosas, grills and house specialities."
  }'),
  ('hero_images', '[
    "/hero/desktop-food-spread.jpg",
    "/hero/desktop-interior.jpg",
    "/hero/desktop-bar.jpg",
    "/hero/desktop-table.jpg"
  ]'),
  ('about_excerpt', '{
    "title": "Where Every Dish Tells a Story of",
    "titleGold": "Passion & Heritage",
    "text1": "The Royal Chilli is a contemporary Indian restaurant bringing together the bold flavours of Hyderabad, the traditions of South India and the richness of classic North Indian cuisine.",
    "text2": "From fragrant dum biryanis and regional curries to dosas, tandoori grills, breakfast favourites and modern house specials, our menu is built around authentic recipes, quality ingredients and generous hospitality."
  }'),
  ('our_story_paragraphs', '[
    "The Royal Chilli is a contemporary Indian restaurant bringing together the bold flavours of Hyderabad, the traditions of South India and the richness of classic North Indian cuisine.",
    "From fragrant dum biryanis and regional curries to dosas, tandoori grills, breakfast favourites and modern house specials, our menu is built around authentic recipes, quality ingredients and generous hospitality.",
    "We serve our customers throughout the day with breakfast, lunch, dine-in, takeaway, delivery, catering, private events and bar service, creating a restaurant experience that is accessible, enjoyable and consistently memorable."
  ]'),
  ('opening_hours', '[
    {"day": "Monday", "open": "09:00", "close": "01:00"},
    {"day": "Tuesday", "open": "09:00", "close": "01:00"},
    {"day": "Wednesday", "open": "09:00", "close": "01:00"},
    {"day": "Thursday", "open": "09:00", "close": "01:00"},
    {"day": "Friday", "open": "09:00", "close": "01:00"},
    {"day": "Saturday", "open": "09:00", "close": "01:00"},
    {"day": "Sunday", "open": "09:00", "close": "01:00"}
  ]');

-- =====================
-- SEED: Role Permissions (matches the defaults previously hardcoded in lib/permissions.ts)
-- =====================
INSERT INTO role_permissions (role, permission, granted)
SELECT r.role, p.permission, false
FROM unnest(ARRAY['owner','admin','manager','supervisor','cashier','waiter','chef','kitchen','driver','inventory_manager','accountant','employee']) AS r(role)
CROSS JOIN unnest(ARRAY['manage_staff','manage_inventory','view_crm','manage_crm','manage_drivers','manage_finance','approve_stock_takes']) AS p(permission);

UPDATE role_permissions SET granted = true WHERE permission = 'manage_staff' AND role IN ('owner','admin','manager');
UPDATE role_permissions SET granted = true WHERE permission = 'manage_inventory' AND role IN ('owner','admin','manager','inventory_manager');
UPDATE role_permissions SET granted = true WHERE permission = 'view_crm' AND role IN ('owner','admin','manager','supervisor','cashier','waiter');
UPDATE role_permissions SET granted = true WHERE permission = 'manage_crm' AND role IN ('owner','admin','manager');
UPDATE role_permissions SET granted = true WHERE permission = 'manage_drivers' AND role IN ('owner','admin','manager');
UPDATE role_permissions SET granted = true WHERE permission = 'manage_finance' AND role IN ('owner','admin','manager','accountant');
UPDATE role_permissions SET granted = true WHERE permission = 'approve_stock_takes' AND role IN ('owner','admin','manager');

-- =====================
-- SEED: Menu Categories
-- =====================
INSERT INTO menu_categories (name, color, display_order) VALUES
  ('Veg Starters',     '#22c55e', 1),
  ('Non-Veg Starters', '#ef4444', 2),
  ('Veg Mains',        '#16a34a', 3),
  ('Non-Veg Mains',    '#dc2626', 4),
  ('Biryanis',         '#f97316', 5),
  ('Breads',           '#eab308', 6),
  ('Rice & Sides',     '#ca8a04', 7),
  ('Soups',            '#3b82f6', 8),
  ('Desserts',         '#a855f7', 9),
  ('Drinks',           '#06b6d4', 10);

-- =====================
-- SEED: Menu Items
-- =====================
INSERT INTO menu_items (category_id, name, price, is_veg, display_order) VALUES
  -- Veg Starters (cat 1)
  (1, 'Vegetable Samosa',    4.50,  1, 1),
  (1, 'Paneer Tikka',        7.95,  1, 2),
  (1, 'Chilli Paneer',       7.95,  1, 3),
  (1, 'Veg Spring Roll',     5.50,  1, 4),
  (1, 'Dahi Puri',           5.95,  1, 5),
  (1, 'Onion Bhaji',         4.95,  1, 6),
  -- Non-Veg Starters (cat 2)
  (2, 'Chicken 65',          8.50,  0, 1),
  (2, 'Chicken Tikka',       8.95,  0, 2),
  (2, 'Lamb Seekh Kebab',    9.50,  0, 3),
  (2, 'Prawn Puri',          9.95,  0, 4),
  (2, 'Fish Pakora',         8.95,  0, 5),
  -- Veg Mains (cat 3)
  (3, 'Dal Makhani',         9.95,  1, 1),
  (3, 'Palak Paneer',        10.95, 1, 2),
  (3, 'Paneer Butter Masala',11.50, 1, 3),
  (3, 'Chana Masala',        9.50,  1, 4),
  (3, 'Mix Veg Curry',       9.95,  1, 5),
  (3, 'Mushroom Masala',     9.95,  1, 6),
  -- Non-Veg Mains (cat 4)
  (4, 'Butter Chicken',      12.95, 0, 1),
  (4, 'Chicken Tikka Masala',12.95, 0, 2),
  (4, 'Lamb Rogan Josh',     13.95, 0, 3),
  (4, 'Lamb Balti',          13.50, 0, 4),
  (4, 'Prawn Masala',        14.50, 0, 5),
  (4, 'Chicken Madras',      12.50, 0, 6),
  (4, 'King Prawn Curry',    15.95, 0, 7),
  -- Biryanis (cat 5)
  (5, 'Chicken Dum Biryani', 13.95, 0, 1),
  (5, 'Lamb Dum Biryani',    14.95, 0, 2),
  (5, 'Veg Biryani',         11.95, 1, 3),
  (5, 'Prawn Biryani',       15.95, 0, 4),
  -- Breads (cat 6)
  (6, 'Plain Naan',          2.50,  1, 1),
  (6, 'Garlic Naan',         3.00,  1, 2),
  (6, 'Peshwari Naan',       3.50,  1, 3),
  (6, 'Paratha',             2.95,  1, 4),
  (6, 'Roti',                2.00,  1, 5),
  (6, 'Puri',                2.50,  1, 6),
  -- Rice & Sides (cat 7)
  (7, 'Steamed Rice',        3.00,  1, 1),
  (7, 'Pilau Rice',          3.50,  1, 2),
  (7, 'Raita',               2.50,  1, 3),
  (7, 'Papadum',             1.00,  1, 4),
  (7, 'Mango Chutney',       1.00,  1, 5),
  (7, 'Mixed Pickle',        1.00,  1, 6),
  -- Soups (cat 8)
  (8, 'Tomato Shorba',       4.95,  1, 1),
  (8, 'Mulligatawny',        5.50,  0, 2),
  (8, 'Sweet Corn Soup',     4.95,  1, 3),
  -- Desserts (cat 9)
  (9, 'Gulab Jamun',         4.50,  1, 1),
  (9, 'Kulfi',               4.95,  1, 2),
  (9, 'Rasmalai',            5.50,  1, 3),
  (9, 'Ice Cream',           3.95,  1, 4),
  -- Drinks (cat 10)
  (10, 'Mango Lassi',        4.00,  1, 1),
  (10, 'Sweet Lassi',        3.50,  1, 2),
  (10, 'Salted Lassi',       3.50,  1, 3),
  (10, 'Masala Chai',        2.50,  1, 4),
  (10, 'Soft Drink',         2.00,  1, 5),
  (10, 'Water',              1.50,  1, 6);

-- =====================
-- SEED: Restaurant Tables
-- =====================
INSERT INTO restaurant_tables (table_number, capacity, location) VALUES
  ('T1',  2, 'main'),
  ('T2',  4, 'main'),
  ('T3',  4, 'main'),
  ('T4',  6, 'main'),
  ('T5',  4, 'main'),
  ('T6',  4, 'main'),
  ('T7',  8, 'main'),
  ('T8',  2, 'outdoor'),
  ('T9',  4, 'outdoor'),
  ('T10', 6, 'private');

-- =====================
-- SEED: Open Work Period
-- =====================
INSERT INTO work_periods (opened_by, opening_cash, status)
  SELECT id, 100.00, 'open' FROM staff WHERE role = 'owner' LIMIT 1;
