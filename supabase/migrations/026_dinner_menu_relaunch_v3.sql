-- Dinner menu relaunch v3: adopts RC_online_order.xlsx (119 items) as the
-- authoritative dinner menu, splitting several items that v2's relaunch had
-- merged into single-item-with-modifier back into separate standalone items
-- (per the new spreadsheet's structure), consolidates Noodles/Rice/Breads
-- into one category, and rolls out a shared "Spice Level" modifier across
-- everything except Rice, Desserts and Breads.
--
-- Same conventions as 022/023: UPDATE in place preserving id (order history
-- intact), true drops marked inactive not deleted, comments note "-- was: X"
-- where renamed. Un-merges delete the now-unused modifier_groups row, which
-- cascades to its modifier_options and menu_item_modifier_groups rows
-- automatically (both ON DELETE CASCADE to modifier_groups).

BEGIN;

-- =====================================================================
-- 1. CATEGORY CONSOLIDATION — Noodles & Fried Rice (30) absorbs
--    Rice & Sides (29) and Breads (31), renamed to match the spreadsheet.
-- =====================================================================
UPDATE menu_categories SET name = 'Noodles, Rice and Breads' WHERE id = 30;
UPDATE menu_items SET category_id = 30 WHERE category_id IN (29, 31);
UPDATE menu_categories SET active = 0 WHERE id IN (29, 31);
UPDATE menu_categories SET name = 'Soups and Sides' WHERE id = 36;

-- =====================================================================
-- 2. SOUPS AND SIDES (category 36)
--    Reverts from the two generic items back to full flavour variety.
-- =====================================================================
UPDATE menu_items SET active = 0 WHERE id IN (242, 243); -- Vegetarian Soups, Non-Vegetarian Soups (generic, retired)

UPDATE menu_items SET active = 1, price = 5.95 WHERE id = 235; -- Veg Sweet Corn Soup (was inactive)
UPDATE menu_items SET active = 1, price = 5.95 WHERE id = 236; -- Veg Lemon Coriander Soup (was inactive)
UPDATE menu_items SET active = 1, price = 5.95 WHERE id = 237; -- Veg Hot & Sour Soup (was inactive)
UPDATE menu_items SET active = 1, price = 7.45 WHERE id = 238; -- Veg Manchow Soup (was inactive)
UPDATE menu_items SET active = 1, price = 7.45 WHERE id = 239; -- Chicken Sweet Corn Soup (was inactive)
UPDATE menu_items SET active = 1, price = 7.45 WHERE id = 240; -- Chicken Hot & Sour Soup (was inactive)
UPDATE menu_items SET active = 1, price = 8.45 WHERE id = 241; -- Chicken Manchow Soup (was inactive)

UPDATE menu_items SET price = 6.95, name = 'Onion Pakodi' WHERE id = 245; -- was "Onion Pakoda"
UPDATE menu_items SET price = 6.95 WHERE id = 246; -- Egg Bonda
UPDATE menu_items SET price = 5.95 WHERE id = 247; -- Chicken Nuggets
UPDATE menu_items SET price = 5.95 WHERE id = 248; -- Spring Rolls

-- Papad (Plain or Masala) or Fries un-merges into 3 separate items.
UPDATE menu_items SET active = 0 WHERE id = 244;

INSERT INTO menu_items (category_id, name, price, is_veg, active, display_order) VALUES
  (36, 'Chicken Lemon Coriander Soup', 7.45, 0, 1, 20),
  (36, 'Prawn Sweet Corn Soup', 8.45, 0, 1, 21),
  (36, 'Prawn Lemon Coriander Soup', 8.45, 0, 1, 22),
  (36, 'Prawn Hot & Sour Soup', 8.45, 0, 1, 23),
  (36, 'Prawn Manchow Soup', 9.45, 0, 1, 24),
  (36, 'Plain Papad', 3.45, 1, 1, 25),
  (36, 'Masala Papad', 3.45, 1, 1, 26),
  (36, 'Fries', 3.45, 1, 1, 27),
  (36, 'Palak Pakodi', 6.95, 1, 1, 28),
  (36, 'Raw Banana Bajji', 6.95, 1, 1, 29),
  (36, 'Aloo Bajji', 6.95, 1, 1, 30),
  (36, 'Bread Bajji', 6.95, 1, 1, 31);

-- =====================================================================
-- 3. VEGETARIAN STARTERS (category 32)
-- =====================================================================
UPDATE menu_items SET active = 0 WHERE id = 139; -- Malai Broccoli (not on new menu)
UPDATE menu_items SET price = 11.95 WHERE id = 145; -- Lotus Stem
UPDATE menu_items SET price = 9.95 WHERE id = 148; -- Veg Manchurian
UPDATE menu_items SET price = 9.95 WHERE id = 147; -- Gobi Manchurian
UPDATE menu_items SET price = 12.45 WHERE id = 249; -- Vegetarian Platter
UPDATE menu_items SET price = 7.95 WHERE id = 251; -- Vankai (Brinjal) Bajji
UPDATE menu_items SET price = 10.45, name = 'Crispy Corn Nibblets' WHERE id = 146; -- was "Crispy Corn Nibbles"

-- Stuffed Bajji or Cut Mirchi un-merges into 2 separate items.
UPDATE menu_items SET active = 0 WHERE id = 232;

INSERT INTO menu_items (category_id, name, price, is_veg, active, display_order) VALUES
  (32, 'Stuffed Bajji', 7.95, 1, 1, 10),
  (32, 'Cut Mirchi', 7.95, 1, 1, 11),
  (32, 'Paneer Pakodi', 11.95, 1, 1, 12),
  (32, 'Paneer 65', 11.95, 1, 1, 13);

-- =====================================================================
-- 4. NON-VEGETARIAN STARTERS (category 26)
-- =====================================================================
UPDATE menu_items SET price = 15.45 WHERE id = 134; -- Pomfret Fry
UPDATE menu_items SET price = 11.95 WHERE id = 213; -- Fish Pakoda
UPDATE menu_items SET price = 11.95 WHERE id = 140; -- Lasooni Chilli Chicken Fry
UPDATE menu_items SET price = 15.45 WHERE id = 142; -- Lamb Ghee Roast
UPDATE menu_items SET price = 11.95 WHERE id = 141; -- Karivepaku Chicken Fry

UPDATE menu_items SET active = 0 WHERE id IN (252, 253); -- Regular Chicken/Prawn Starter (retired — spreadsheet reverts to specific items)

-- Egg un-merges into 2 separate items.
UPDATE menu_items SET active = 0 WHERE id = 254;

UPDATE menu_items SET active = 1, price = 10.45 WHERE id = 144; -- Chicken 65 (was inactive)
UPDATE menu_items SET active = 1, price = 10.45 WHERE id = 214; -- Chilli Chicken (was inactive)
UPDATE menu_items SET active = 1, price = 10.45 WHERE id = 215; -- Chicken Pakoda (was inactive)
UPDATE menu_items SET active = 1, price = 10.45 WHERE id = 216; -- Chicken Majestic (was inactive)
UPDATE menu_items SET active = 1, price = 10.45 WHERE id = 217; -- Chicken Manchurian (was inactive)

INSERT INTO menu_items (category_id, name, price, is_veg, active, display_order) VALUES
  (26, 'Egg Masala', 10.45, 0, 1, 14),
  (26, 'Egg Buji', 10.45, 0, 1, 15),
  (26, 'Pepper Prawns', 13.45, 0, 1, 16),
  (26, 'Garlic Chilli Prawns', 13.45, 0, 1, 17),
  (26, 'Butter Garlic Prawns', 13.45, 0, 1, 18);

-- =====================================================================
-- 5. PREMIUM GRILLS (category 25) — clean, straight reprices
-- =====================================================================
UPDATE menu_items SET price = 22.45 WHERE id = 131; -- The Royal Tandoori Platter
UPDATE menu_items SET price = 15.95 WHERE id = 209; -- Lamb Chops
UPDATE menu_items SET price = 15.95 WHERE id = 133; -- Bang Bang King Prawns
UPDATE menu_items SET price = 12.45 WHERE id = 210; -- Sheekh Kebabs
UPDATE menu_items SET price = 10.45 WHERE id = 211; -- Chicken Tikka
UPDATE menu_items SET price = 10.45 WHERE id = 212; -- Malai Tikka (no longer priced as Chicken Tikka + delta)

-- =====================================================================
-- 6. VEGETARIAN MAINS (category 34)
-- =====================================================================
UPDATE menu_items SET price = 14.45 WHERE id = 161; -- Shahi Makhaana Curry
UPDATE menu_items SET price = 14.45 WHERE id = 163; -- Paneer Lababdar
UPDATE menu_items SET price = 12.95 WHERE id = 164; -- Vegetarian Kofta Curry
UPDATE menu_items SET price = 10.95 WHERE id = 257; -- Aubergine (Vankaya) Masala
UPDATE menu_items SET active = 0 WHERE id = 162; -- 24 Karat Malai Palak Curry (not on new menu)

-- Dal Tadka or Gongura Dal un-merges into 2 separate items.
UPDATE menu_items SET name = 'Dal Tadka', price = 7.95 WHERE id = 165;
-- Choice of Paneer un-merges into 4 separate items.
UPDATE menu_items SET active = 0 WHERE id = 255;
-- Bhindi un-merges into 2 separate items.
UPDATE menu_items SET active = 0 WHERE id = 256;

INSERT INTO menu_items (category_id, name, price, is_veg, active, display_order) VALUES
  (34, 'Gongura Dal', 8.45, 1, 1, 5),
  (34, 'Paneer Butter Masala', 10.95, 1, 1, 6),
  (34, 'Paneer Tikka Masala', 10.95, 1, 1, 7),
  (34, 'Palak Paneer', 10.95, 1, 1, 8),
  (34, 'Kadai Paneer', 10.95, 1, 1, 9),
  (34, 'Bhindi Kurkure', 10.95, 1, 1, 10),
  (34, 'Bhindi Masala', 10.95, 1, 1, 11);

-- =====================================================================
-- 7. NON-VEGETARIAN MAINS (category 27)
-- =====================================================================
UPDATE menu_items SET price = 15.45 WHERE id = 218; -- Haleem
UPDATE menu_items SET active = 0 WHERE id = 151; -- Lamb Champaaran (not on new menu)
UPDATE menu_items SET name = 'Lamb Rogan Josh', price = 15.95 WHERE id = 153; -- was "Kashmiri Rogan Josh"
UPDATE menu_items SET price = 13.45 WHERE id = 220; -- Gongura Chicken
UPDATE menu_items SET price = 15.95 WHERE id = 221; -- Gongura Lamb
UPDATE menu_items SET price = 16.95 WHERE id = 222; -- Gongura Prawns
UPDATE menu_items SET price = 15.45 WHERE id = 157; -- Chicken Changezi

-- Raju Gari Chicken/Prawn Curry un-merges.
UPDATE menu_items SET name = 'Raju Gari Chicken Curry', price = 15.45 WHERE id = 219;
UPDATE menu_items SET active = 1, price = 16.95 WHERE id = 154; -- Raju Gari Prawn Curry (was inactive)

-- Tawa Chicken/Lamb un-merges.
UPDATE menu_items SET name = 'Tawa Chicken', price = 15.45 WHERE id = 156;
UPDATE menu_items SET active = 1, price = 16.95 WHERE id = 155; -- Tawa Lamb (was inactive)

-- Chicken Tikka Masala / Butter Chicken un-merges.
UPDATE menu_items SET name = 'Chicken Tikka Masala', price = 12.45 WHERE id = 223;
UPDATE menu_items SET active = 1, price = 12.45 WHERE id = 160; -- Butter Chicken (was inactive)

-- =====================================================================
-- 8. BIRYANI (category 28)
-- =====================================================================
UPDATE menu_items SET active = 1, price = 22.45 WHERE id = 166; -- Nalli Gosht Biryani (was inactive)
UPDATE menu_items SET price = 15.45 WHERE id = 167; -- Lamb Dum Biryani
UPDATE menu_items SET price = 15.45 WHERE id = 168; -- Prawn Biryani
UPDATE menu_items SET price = 8.95 WHERE id = 169; -- Chicken Dum Biryani
UPDATE menu_items SET name = 'Vegetarian Biryani', price = 8.45 WHERE id = 172; -- was "Veg Biryani"

-- Special Chicken Biryani un-merges into the 3 specific biryanis.
UPDATE menu_items SET active = 0 WHERE id = 258;
UPDATE menu_items SET active = 1, price = 12.45 WHERE id = 170; -- Chicken 65 Biryani (was inactive)
UPDATE menu_items SET active = 1, price = 12.45 WHERE id = 224; -- Chicken Tikka Biryani (was inactive)
UPDATE menu_items SET active = 1, price = 11.95, name = 'Fry Piece Chicken Biryani' WHERE id = 171; -- was "Chicken Fry Piece Biryani"

-- =====================================================================
-- 9. NOODLES, RICE AND BREADS (category 30, consolidated above)
-- =====================================================================
-- Noodles: restore "Hakka" naming, reprice.
UPDATE menu_items SET name = 'Vegetable Hakka Noodles', price = 7.95 WHERE id = 179;
UPDATE menu_items SET name = 'Egg Hakka Noodles', price = 9.45 WHERE id = 178;
UPDATE menu_items SET name = 'Chicken Hakka Noodles', price = 9.45 WHERE id = 177;
UPDATE menu_items SET name = 'Prawn Hakka Noodles', price = 10.45 WHERE id = 229;
UPDATE menu_items SET price = 7.95 WHERE id = 230; -- Vegetable Fried Rice
UPDATE menu_items SET price = 8.45 WHERE id = 174; -- Egg Fried Rice
UPDATE menu_items SET price = 9.45 WHERE id = 173; -- Chicken Fried Rice
UPDATE menu_items SET price = 10.45 WHERE id = 231; -- Prawn Fried Rice

-- Flavoured Rice un-merges back into individual rice items.
UPDATE menu_items SET active = 0 WHERE id = 259;
UPDATE menu_items SET active = 1, price = 5.95 WHERE id = 176; -- Jeera Rice (was inactive)
UPDATE menu_items SET active = 1, price = 5.95 WHERE id = 225; -- Pilau Rice (was inactive)
UPDATE menu_items SET active = 1, price = 5.95 WHERE id = 226; -- Mushroom Rice (was inactive)
UPDATE menu_items SET active = 1, price = 5.95 WHERE id = 175; -- Bagaara Rice (was inactive)

UPDATE menu_items SET price = 4.95 WHERE id = 227; -- Plain Rice
UPDATE menu_items SET name = 'Ragi Sangati with Kodi Pulusu', price = 12.95,
  description = 'Traditional Rayalaseema-style finger millet and rice dumpling.' WHERE id = 228; -- was plain "Ragi Sangati"

-- Breads.
UPDATE menu_items SET active = 1, price = 8.95,
  description = 'Three naans: Garlic, Chilli Garlic and Butter Naan.' WHERE id = 192; -- Bread Basket (was inactive)
UPDATE menu_items SET name = 'Plain Naan', price = 2.45 WHERE id = 181; -- was "Naan"
UPDATE menu_items SET price = 4.95 WHERE id = 180; -- Kheema Naan
UPDATE menu_items SET price = 2.45 WHERE id = 182; -- Butter Naan
UPDATE menu_items SET price = 2.95 WHERE id = 183; -- Garlic Naan
UPDATE menu_items SET price = 2.95 WHERE id = 185; -- Chilli Garlic Naan
UPDATE menu_items SET price = 3.45 WHERE id = 184; -- Cheese Naan
UPDATE menu_items SET price = 2.45 WHERE id = 186; -- Tawa Roti
UPDATE menu_items SET price = 2.45 WHERE id = 188; -- Tandoori Roti

INSERT INTO menu_items (category_id, name, price, is_veg, active, display_order) VALUES
  (30, 'Mixed Noodles', 11.95, 1, 1, 40),
  (30, 'Mixed Fried Rice', 11.95, 1, 1, 41),
  (30, 'Lemon Rice', 5.95, 1, 1, 42),
  (30, 'Podhina Rice', 5.95, 1, 1, 43),
  (30, 'Sambar Rice', 6.45, 1, 1, 44);

-- =====================================================================
-- 10. DESSERTS (category 33) — clean, straight reprices
-- =====================================================================
UPDATE menu_items SET price = 6.95 WHERE id = 193; -- Apricot Delight
UPDATE menu_items SET price = 6.95 WHERE id = 194; -- Kunafe
UPDATE menu_items SET price = 4.45 WHERE id = 196; -- Gulab Jamun
UPDATE menu_items SET price = 6.95 WHERE id = 195; -- Cheesecake

-- =====================================================================
-- 11. SPICE LEVEL — shared modifier across every active item in the
--     touched categories except Rice items, Breads, and Desserts.
--     Name-based exclusion for category 30 (rice/bread items all contain
--     "Rice", "Naan", "Roti" or "Bread Basket"/"Ragi Sangati" in their
--     name) rather than an id list, so it doesn't depend on knowing the
--     ids just inserted above.
-- =====================================================================
WITH grp AS (
  INSERT INTO modifier_groups (name, selection_type, min_select, max_select)
  VALUES ('Spice Level', 'single', 1, 1) RETURNING id
), qualifying AS (
  SELECT id FROM menu_items
  WHERE active = 1
    AND (
      category_id IN (36, 32, 26, 25, 34, 27, 28)
      OR (
        category_id = 30
        AND name NOT ILIKE '%rice%'
        AND name NOT ILIKE '%naan%'
        AND name NOT ILIKE '%roti%'
        AND name NOT ILIKE '%bread basket%'
        AND name NOT ILIKE '%ragi sangati%'
      )
    )
), link AS (
  INSERT INTO menu_item_modifier_groups (menu_item_id, group_id, required, display_order)
  SELECT qualifying.id, grp.id, 1, 10 FROM qualifying, grp
  RETURNING group_id
)
-- link returns one row per linked item (all the same group_id) — referenced
-- via EXISTS, not cross-joined, so it can't multiply this insert by however
-- many items got linked. grp x opt alone gives exactly the 3 rows wanted.
INSERT INTO modifier_options (group_id, name, price_delta, display_order)
SELECT grp.id, opt.name, opt.price_delta, opt.display_order FROM grp,
  (VALUES ('Mild', 0, 1), ('Medium', 0, 2), ('Hot', 0, 3)) AS opt(name, price_delta, display_order)
WHERE EXISTS (SELECT 1 FROM link);

COMMIT;
