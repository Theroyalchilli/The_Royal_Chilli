-- Queue of tickets waiting to be picked up by the reception printer (Star
-- mC-Print3) via Star's CloudPRNT protocol — the printer itself polls
-- app/api/cloudprnt every few seconds; no local device/browser involved.
-- A row here is created the moment a website order is placed and marked
-- printed once the printer confirms it received the job (DELETE step).

CREATE TABLE IF NOT EXISTS print_jobs (
  id          SERIAL PRIMARY KEY,
  order_id    INT REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  printed_at  TIMESTAMPTZ
);

ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;
-- No anon policies: only the server (service_role) and the CloudPRNT route
-- (also server-side) touch this — the printer itself talks to our API, not
-- directly to Supabase.
