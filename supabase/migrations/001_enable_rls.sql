-- Royal Chilli ROS — Security Fix #1: Enable Row Level Security
-- Run this in the Supabase SQL Editor (Project → SQL Editor → New Query).
--
-- Context: every table was created with RLS disabled, and the only API key
-- in use anywhere (website + POS) is the anon/publishable key. That meant
-- anyone with the key (visible in the website's public JS) had full
-- read/write access to staff PIN hashes, payments, orders, and reservations.
--
-- Fix: turn RLS on everywhere. The POS app (royal-chilli-pos) switches to
-- the service_role key server-side, which bypasses RLS entirely — so the
-- POS keeps working exactly as before with no policy needed for it.
-- The public website still uses the anon key directly from the browser, so
-- we grant it the minimum it needs: insert-only on orders/order_items/
-- reservations, and read-only on the active menu. Nothing else is reachable
-- by anon under any circumstance.

ALTER TABLE staff             ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_periods      ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations      ENABLE ROW LEVEL SECURITY;

-- Public menu needs to be readable by the anon key (website menu display).
CREATE POLICY anon_read_active_menu_categories ON menu_categories
  FOR SELECT TO anon USING (active = 1);

CREATE POLICY anon_read_active_menu_items ON menu_items
  FOR SELECT TO anon USING (active = 1);

-- Website checkout/reservation forms need to create rows, never read/edit/delete.
CREATE POLICY anon_insert_orders ON orders
  FOR INSERT TO anon WITH CHECK (order_type = 'online');

CREATE POLICY anon_insert_order_items ON order_items
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY anon_insert_reservations ON reservations
  FOR INSERT TO anon WITH CHECK (source = 'website');

-- No policies are created for staff, work_periods, payments, restaurant_tables,
-- or for SELECT/UPDATE/DELETE on orders/order_items/reservations for the anon
-- role — with RLS enabled and no matching policy, Postgres denies by default.
-- The POS app's service_role key bypasses RLS entirely and is unaffected.
