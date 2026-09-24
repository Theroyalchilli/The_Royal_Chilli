-- Training records become append-only like every other food-safety record
-- (no delete — a wrong entry is superseded by a new one, never erased), and
-- gain a file reference so a certificate scan/PDF can be attached.

ALTER TABLE fs_training_record ADD COLUMN IF NOT EXISTS certificate_ref TEXT;

CREATE TRIGGER trg_fs_training_record_append_only BEFORE UPDATE OR DELETE ON fs_training_record
  FOR EACH ROW EXECUTE FUNCTION fs_reject_mutation();

-- Private bucket for training certificates and (later) check photo evidence
-- — same pattern as the attendance app's existing attendance-photos bucket
-- (030_attendance_rebuild.sql): never public, always served via a
-- short-lived signed URL.
INSERT INTO storage.buckets (id, name, public)
VALUES ('food-safety-files', 'food-safety-files', false)
ON CONFLICT (id) DO NOTHING;
