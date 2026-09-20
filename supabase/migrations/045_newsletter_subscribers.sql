-- Public-site newsletter capture — separate from `customers` since most
-- subscribers here are anonymous visitors, not account holders. Opt-in is
-- the act of submitting the form itself, so there's no extra consent flag
-- to track (unlike customers.marketing_consent, which covers people who
-- didn't necessarily ask for marketing just by having an account).
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
