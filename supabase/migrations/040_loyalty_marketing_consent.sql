-- Doc requirement: loyalty membership must never be assumed to imply
-- marketing consent. Defaults to FALSE — an admin has to explicitly opt a
-- customer in (e.g. from the Customer detail view) before any win-back or
-- other non-transactional marketing email can be sent to them. Transactional
-- emails (order/reservation confirmations) are unaffected — those aren't
-- marketing and don't check this flag.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT FALSE;
