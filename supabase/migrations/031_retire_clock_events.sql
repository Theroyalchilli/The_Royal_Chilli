-- Attendance has moved to the dedicated royal-chilli-attendance app (its own
-- Vercel project, this same Supabase database, the `attendance` / `timesheets`
-- tables added in migration 030 + the kiosk).
--
-- clock_events held only 3 five-second test punches by "Admin"; breaks is empty.
-- Nothing real is lost. `shifts` and `staff_availability` STAY — the attendance
-- app's rota reads/writes `shifts`.
--
-- Payroll now reads hours from LOCKED `timesheets` instead of clock_events
-- (see lib/payroll.ts).

DROP TABLE IF EXISTS breaks CASCADE;
DROP TABLE IF EXISTS clock_events CASCADE;
