-- Module 4 continued: Rota — recurring weekly availability per staff member.
-- day_of_week matches JS Date.getDay(): 0=Sunday .. 6=Saturday.
CREATE TABLE IF NOT EXISTS staff_availability (
  id            SERIAL PRIMARY KEY,
  staff_id      INT REFERENCES staff(id) NOT NULL,
  day_of_week   INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_available  INT NOT NULL DEFAULT 1,
  notes         TEXT,
  UNIQUE (staff_id, day_of_week)
);
ALTER TABLE staff_availability ENABLE ROW LEVEL SECURITY;
-- No anon policies: server-only, like the rest of Staff Hub.
