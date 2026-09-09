-- Per-channel menu pricing + availability.
--
-- Until now menu_items had ONE price and both the website and the POS till
-- read it. That single figure was the WEBSITE (delivery-marked-up) price, so
-- the till has been overcharging dine-in / collection customers.
--
-- This splits it:
--   price            -> in-house / POS till price
--   online_price     -> website price
--   pos_available    -> show on the till menu?     (1/0)
--   online_available -> show on the website menu?  (1/0)
--
-- The price figures themselves are loaded straight from the two source
-- spreadsheets right after this migration by scripts/import-menu-prices.js:
--   online  -> RC_online_order.xlsx
--   offline -> "Dinner menu  Inside.xlsx"
-- so this file only makes the structural change and preserves today's
-- behaviour until that script runs.

BEGIN;

ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS online_price     NUMERIC(10,2);
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS pos_available    INT DEFAULT 1;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS online_available INT DEFAULT 1;

-- Current `price` is the website price today — copy it into online_price so the
-- website renders identically until the import script sets real values.
UPDATE menu_items SET online_price = price WHERE online_price IS NULL;

-- The two spreadsheets are the whole menu. Breakfast (39), Lunch Combos (40)
-- and Combos (35) are in neither, so they come off both the till and the
-- website — deactivated, not deleted, so they can be brought back later.
UPDATE menu_items      SET active = 0 WHERE category_id IN (35, 39, 40);
UPDATE menu_categories SET active = 0 WHERE id IN (35, 39, 40);

-- Spelling fix so it matches the offline spreadsheet ("Karot" -> "Karat").
-- The import script then matches this row and reactivates it as a till-only
-- dish (it is not on the online sheet).
UPDATE menu_items SET name = '24 Karat Malai Palak Curry' WHERE id = 162;

COMMIT;
