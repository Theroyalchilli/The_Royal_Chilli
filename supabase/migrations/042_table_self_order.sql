-- QR self-ordering (app/(public)/table/[tableNumber]) is otherwise a fully
-- public, unauthenticated endpoint keyed only on a guessable table number —
-- anyone off-premises could push fake orders straight to the kitchen for any
-- table. Gate it behind a staff-controlled flag: a table only accepts public
-- orders once staff has explicitly opened it for self-service, and it's reset
-- to closed whenever the table is freed (see cancelOrderAndFreeTable and the
-- payment/pay-later/reservation flows that set status back to "available").
ALTER TABLE restaurant_tables
  ADD COLUMN IF NOT EXISTS self_order_enabled BOOLEAN NOT NULL DEFAULT false;
