-- Courses need the same "retire, don't delete" protection checks/temps
-- already have — fs_training_record references course_id, so a course with
-- history against it can never be truly removed, only deactivated.
ALTER TABLE fs_course ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
