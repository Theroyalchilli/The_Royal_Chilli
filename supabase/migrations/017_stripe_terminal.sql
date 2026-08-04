-- In-person card payments via a real Stripe Terminal card reader, on the same
-- Stripe account already used for website payments. Empty by default — the
-- POS falls back to the existing "manually record card payment" flow (for a
-- separate card machine) until a reader is registered and its ID set here.
INSERT INTO app_settings (key, value)
VALUES ('stripe_terminal_reader_id', '""')
ON CONFLICT (key) DO NOTHING;
