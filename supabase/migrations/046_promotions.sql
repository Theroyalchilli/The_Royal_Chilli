-- Simple single-active-promotion model — the site shows whichever row has
-- active = true (most recently created if more than one is ever set active
-- at once, though the UI is meant to only ever have one on).
CREATE TABLE IF NOT EXISTS promotions (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  link_url    TEXT,
  active      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
