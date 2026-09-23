-- Actual uploaded files (passport scans, contracts, certificates...) behind
-- the "Document Checklist" on the Onboarding tab, which only ever recorded
-- that a document was shown to someone, never the document itself. Files
-- live in the private "employee-documents" Storage bucket (created via
-- scripts/create-employee-documents-bucket.js, not a migration) — this
-- table is just the metadata pointing at them.
CREATE TABLE IF NOT EXISTS employee_documents (
  id           SERIAL PRIMARY KEY,
  staff_id     INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  doc_type     TEXT NOT NULL CHECK (doc_type IN ('passport', 'visa_brp', 'p45_starter', 'contract', 'certificate', 'reference', 'other')),
  file_path    TEXT NOT NULL,
  file_name    TEXT NOT NULL,
  expiry_date  DATE,
  uploaded_by  INTEGER REFERENCES staff(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_documents_staff ON employee_documents(staff_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_expiry ON employee_documents(expiry_date) WHERE expiry_date IS NOT NULL;
