-- Z report (end-of-day) rework — needs 058_print_queue.sql first.
--
-- 1. Snapshot of the Z report taken when a shift is closed (lib/z-report.ts),
--    so reprinting an old report shows exactly what was printed that night.
ALTER TABLE work_periods ADD COLUMN IF NOT EXISTS z_report JSONB;

-- 2. The Star printer queue can now print a Z report, which belongs to a
--    shift rather than an order.
ALTER TABLE print_jobs ALTER COLUMN order_id DROP NOT NULL;
ALTER TABLE print_jobs
  ADD COLUMN IF NOT EXISTS work_period_id INT REFERENCES work_periods(id) ON DELETE CASCADE;

ALTER TABLE print_jobs DROP CONSTRAINT IF EXISTS print_jobs_kind_check;
ALTER TABLE print_jobs ADD CONSTRAINT print_jobs_kind_check CHECK (kind IN ('kot', 'receipt', 'zreport'));

ALTER TABLE print_jobs DROP CONSTRAINT IF EXISTS print_jobs_target_check;
ALTER TABLE print_jobs ADD CONSTRAINT print_jobs_target_check CHECK (
  (kind = 'zreport' AND work_period_id IS NOT NULL) OR (kind <> 'zreport' AND order_id IS NOT NULL)
);
