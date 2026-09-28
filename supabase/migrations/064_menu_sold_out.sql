-- "Sold out" at the till: a dish marked sold out disappears from the website
-- and table-QR menus (and can't be ordered) until this time — the start of
-- the next trading day (5am UK), so tomorrow starts with the full menu.
-- NULL = available.
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS sold_out_until TIMESTAMPTZ;
