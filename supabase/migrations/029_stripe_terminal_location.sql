-- Payments run on Stripe: Stripe Checkout for website orders + reservation
-- deposits (app/api/public/**/checkout-session, verified by
-- app/api/stripe/webhook), and Stripe Terminal for in-person card payments at
-- the till (app/api/pos/terminal/*).
--
-- The brief SumUp detour (old migration 024) was never applied anywhere and
-- has been removed; its code is gone too. The Stripe columns it would have
-- sat alongside — orders.stripe_session_id, reservations.stripe_session_id —
-- and the stripe_terminal_reader_id setting all still exist from migrations
-- 016/017, so the only thing missing is where to store the Terminal Location.
--
-- Stripe requires every Terminal reader to belong to a "Location" (a postal
-- address). app/api/pos/terminal/pair creates one on first pairing, using the
-- fixed premises address in lib/stripe.ts, and stashes its id here.

INSERT INTO app_settings (key, value)
VALUES ('stripe_terminal_location_id', '""')
ON CONFLICT (key) DO NOTHING;
