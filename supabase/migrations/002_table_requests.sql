-- Module 3: QR dine-in — "Call Waiter" / "Request Bill" from a table.
CREATE TABLE IF NOT EXISTS table_requests (
  id          SERIAL PRIMARY KEY,
  table_id    INT REFERENCES restaurant_tables(id) NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('waiter', 'bill')),
  status      TEXT NOT NULL CHECK (status IN ('pending', 'resolved')) DEFAULT 'pending',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
ALTER TABLE table_requests ENABLE ROW LEVEL SECURITY;
-- No anon policies: only the server (service_role) ever touches this table.
