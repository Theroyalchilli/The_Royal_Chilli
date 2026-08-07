-- HR onboarding / right-to-work / new-starter checklist.
-- Kept as separate tables from `staff` rather than more columns on it:
-- staff is queried constantly (auth, orders, rota) and most of this data
-- is sensitive and only ever needed on the one HR screen.

CREATE TABLE IF NOT EXISTS staff_hr_details (
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

  -- Self-declared right-to-work info (from the employee's onboarding form,
  -- distinct from the employer's own verification in staff_rtw_verification)
  rtw_evidence_method             TEXT,
  rtw_share_code                  TEXT,
  rtw_time_limited                TEXT CHECK (rtw_time_limited IN ('yes', 'no', 'unsure')),
  rtw_permission_expiry_date      DATE,
  rtw_has_restrictions            TEXT CHECK (rtw_has_restrictions IN ('yes', 'no', 'unsure')),
  rtw_restrictions_details        TEXT,
  rtw_is_student                  TEXT CHECK (rtw_is_student IN ('yes', 'no')),
  rtw_student_dates_provided      BOOLEAN DEFAULT false,
  rtw_sponsorship_now             TEXT CHECK (rtw_sponsorship_now IN ('yes', 'no', 'unsure')),
  rtw_sponsorship_future          TEXT CHECK (rtw_sponsorship_future IN ('yes', 'no', 'unsure')),

  -- Payroll / bank — sensitive; ni_number, sort_code and account_number are
  -- masked in every API response except the explicit, audit-logged reveal.
  ni_number                       TEXT,
  p45_available                   TEXT CHECK (p45_available IN ('yes', 'no', 'not_applicable')),
  hmrc_starter_checklist          TEXT CHECK (hmrc_starter_checklist IN ('yes', 'no', 'not_applicable')),
  bank_account_name               TEXT,
  bank_name                       TEXT,
  sort_code                       TEXT,
  account_number                  TEXT,

  emergency_contact_relationship  TEXT,
  emergency_contact_email         TEXT,

  reasonable_adjustment_needed    TEXT CHECK (reasonable_adjustment_needed IN ('yes', 'no', 'prefer_to_discuss')),
  reasonable_adjustment_details   TEXT,

  doc_id_rtw_supplied             BOOLEAN DEFAULT false,
  doc_p45_or_starter_supplied     BOOLEAN DEFAULT false,
  doc_quals_supplied              BOOLEAN DEFAULT false,
  doc_bank_supplied               BOOLEAN DEFAULT false,
  doc_other                       TEXT,

  declaration_confirmed_accurate  BOOLEAN DEFAULT false,
  declaration_will_report_changes BOOLEAN DEFAULT false,
  declaration_read_privacy        BOOLEAN DEFAULT false,
  declaration_signature           TEXT,
  declaration_date                DATE,

  updated_at                      TIMESTAMPTZ DEFAULT NOW(),
  created_at                      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_references (
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
CREATE TABLE IF NOT EXISTS staff_rtw_verification (
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
CREATE TABLE IF NOT EXISTS staff_onboarding_tasks (
  id            SERIAL PRIMARY KEY,
  staff_id      INT REFERENCES staff(id) ON DELETE CASCADE NOT NULL,
  task_key      TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('not_started', 'done')) DEFAULT 'not_started',
  notes         TEXT,
  completed_at  TIMESTAMPTZ,
  completed_by  INT REFERENCES staff(id),
  UNIQUE (staff_id, task_key)
);

ALTER TABLE staff_hr_details        ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_references        ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_rtw_verification  ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_onboarding_tasks  ENABLE ROW LEVEL SECURITY;
-- No anon policies — server-only (canManageStaff-gated API routes), same as
-- the rest of Staff Hub.
