-- Menu relaunch v2: dinner menu reconciled against the new poster pricing,
-- plus Breakfast and Lunch Combos added to online ordering for the first
-- time (previously "Coming Soon" on the marketing site only).
--
-- Same conventions as 022_menu_relaunch.sql: existing items are updated in
-- place (id preserved, order history intact); true drops are marked
-- inactive, never deleted. Where the poster offers a choice at one flat
-- price (or a small upcharge for one option), that's modelled as a single
-- menu item with a modifier group, rather than several near-duplicate items.

BEGIN;

-- =====================================================================
-- 1. DINNER — SOUPS & SIDES (category 36)
--    Poster collapses the flavour-specific soups into two generic items.
-- =====================================================================
INSERT INTO menu_items (category_id, name, price, is_veg, active, display_order) VALUES
  (36, 'Vegetarian Soups', 4.95, 1, 1, 1),
  (36, 'Non-Vegetarian Soups', 5.95, 0, 1, 2),
  (36, 'Papad (Plain or Masala) or Fries', 2.95, 1, 1, 3),
  (36, 'Onion Pakoda', 5.95, 1, 1, 4),
  (36, 'Egg Bonda', 5.95, 0, 1, 5),
  (36, 'Chicken Nuggets', 6.95, 0, 1, 6),
  (36, 'Spring Rolls', 4.95, 1, 1, 7);

UPDATE menu_items SET active = 0 WHERE id IN (235, 236, 237, 238); -- Veg Sweet Corn / Lemon Coriander / Hot & Sour / Manchow Soup
UPDATE menu_items SET active = 0 WHERE id IN (239, 240, 241);      -- Chicken Sweet Corn / Hot & Sour / Manchow Soup

-- =====================================================================
-- 2. DINNER — VEGETARIAN STARTERS (category 32)
-- =====================================================================
UPDATE menu_items SET price = 9.95  WHERE id = 145; -- Lotus Stem
UPDATE menu_items SET price = 9.95  WHERE id = 139; -- Malai Broccoli
UPDATE menu_items SET price = 8.95  WHERE id = 148; -- Veg Manchurian
UPDATE menu_items SET price = 8.95  WHERE id = 147; -- Gobi Manchurian
UPDATE menu_items SET active = 1, price = 8.95, name = 'Crispy Corn Nibbles' WHERE id = 146; -- was inactive "Crispy Corn Niblets" — price already matched

INSERT INTO menu_items (category_id, name, price, is_veg, active, display_order) VALUES
  (32, 'Vegetarian Platter', 11.95, 1, 1, 8),
  (32, 'Chilli Paneer', 9.95, 1, 1, 9),
  (32, 'Vankai (Brinjal) Bajji', 6.95, 1, 1, 10);

UPDATE menu_items SET active = 0 WHERE id IN (138, 137); -- Paneer Tikka Sizzler, Soya Chaap Sizzler (not on new menu)

-- Stuffed Bajji or Cut Mirchi: existing "Stuffed Bajji" (id 232) becomes the
-- surviving item with a style choice, rather than adding a near-duplicate.
UPDATE menu_items SET name = 'Stuffed Bajji or Cut Mirchi', price = 6.95 WHERE id = 232;
WITH grp AS (
  INSERT INTO modifier_groups (name, selection_type, min_select, max_select) VALUES ('Choice', 'single', 1, 1) RETURNING id
), link AS (
  INSERT INTO menu_item_modifier_groups (menu_item_id, group_id, required, display_order)
  SELECT 232, id, 1, 1 FROM grp RETURNING group_id
)
INSERT INTO modifier_options (group_id, name, price_delta, display_order)
SELECT grp.id, opt.name, opt.price_delta, opt.display_order FROM grp, link,
  (VALUES ('Stuffed Bajji', 0, 1), ('Cut Mirchi', 0, 2)) AS opt(name, price_delta, display_order);

-- =====================================================================
-- 3. DINNER — NON-VEGETARIAN STARTERS (category 26)
-- =====================================================================
UPDATE menu_items SET price = 12.95 WHERE id = 134; -- Pomfret Fry
UPDATE menu_items SET price = 9.95  WHERE id = 140; -- Lasooni Chilli Chicken Fry
UPDATE menu_items SET price = 9.95, name = 'Karivepaku Chicken Fry' WHERE id = 141; -- was "Curry Leaf Chicken Fry" — same dish, poster uses the Telugu name
UPDATE menu_items SET price = 9.95  WHERE id = 213; -- Fish Pakoda
UPDATE menu_items SET active = 1, price = 12.95 WHERE id = 142; -- Lamb Ghee Roast (was inactive)

INSERT INTO menu_items (category_id, name, price, is_veg, active, display_order) VALUES
  (26, 'Regular Chicken Starter', 8.95, 0, 1, 9),
  (26, 'Regular Prawn Starter', 11.95, 0, 1, 10);
WITH new_item AS (
  INSERT INTO menu_items (category_id, name, price, is_veg, active, display_order)
  VALUES (26, 'Egg', 8.95, 0, 1, 11) RETURNING id
), grp AS (
  INSERT INTO modifier_groups (name, selection_type, min_select, max_select) VALUES ('Style', 'single', 1, 1) RETURNING id
), link AS (
  INSERT INTO menu_item_modifier_groups (menu_item_id, group_id, required, display_order)
  SELECT new_item.id, grp.id, 1, 1 FROM new_item, grp RETURNING group_id
)
INSERT INTO modifier_options (group_id, name, price_delta, display_order)
SELECT grp.id, opt.name, opt.price_delta, opt.display_order FROM grp, link,
  (VALUES ('Masala', 0, 1), ('Bhurji', 0, 2)) AS opt(name, price_delta, display_order);

-- Chicken 65 / Chilli Chicken / Chicken Pakoda / Chicken Majestic / Chicken
-- Manchurian all retire — replaced by the single "Regular Chicken Starter".
UPDATE menu_items SET active = 0 WHERE id IN (144, 214, 215, 216, 217);

-- =====================================================================
-- 4. DINNER — VEGETARIAN MAINS (category 34)
-- =====================================================================
UPDATE menu_items SET price = 12.95 WHERE id = 161; -- Shahi Makhaana Curry
UPDATE menu_items SET price = 12.95 WHERE id = 163; -- Paneer Lababdar
UPDATE menu_items SET price = 10.95 WHERE id = 164; -- Vegetarian Kofta Curry
UPDATE menu_items SET active = 1, price = 12.95, category_id = 34 WHERE id = 162; -- 24 Karat Malai Palak Curry — moves from Non-Veg Mains, price already matched

UPDATE menu_items SET name = 'Dal Tadka or Gongura Dal', price = 6.95 WHERE id = 165;
WITH grp AS (
  INSERT INTO modifier_groups (name, selection_type, min_select, max_select) VALUES ('Choice', 'single', 1, 1) RETURNING id
), link AS (
  INSERT INTO menu_item_modifier_groups (menu_item_id, group_id, required, display_order)
  SELECT 165, id, 1, 1 FROM grp RETURNING group_id
)
INSERT INTO modifier_options (group_id, name, price_delta, display_order)
SELECT grp.id, opt.name, opt.price_delta, opt.display_order FROM grp, link,
  (VALUES ('Dal Tadka', 0, 1), ('Gongura Dal', 0, 2)) AS opt(name, price_delta, display_order);

WITH new_item AS (
  INSERT INTO menu_items (category_id, name, price, is_veg, active, display_order)
  VALUES (34, 'Choice of Paneer', 9.95, 1, 1, 5) RETURNING id
), grp AS (
  INSERT INTO modifier_groups (name, selection_type, min_select, max_select) VALUES ('Paneer Style', 'single', 1, 1) RETURNING id
), link AS (
  INSERT INTO menu_item_modifier_groups (menu_item_id, group_id, required, display_order)
  SELECT new_item.id, grp.id, 1, 1 FROM new_item, grp RETURNING group_id
)
INSERT INTO modifier_options (group_id, name, price_delta, display_order)
SELECT grp.id, opt.name, opt.price_delta, opt.display_order FROM grp, link,
  (VALUES ('Butter Masala', 0, 1), ('Tikka Masala', 0, 2), ('Palak Paneer', 0, 3), ('Kadai Paneer', 0, 4)) AS opt(name, price_delta, display_order);

WITH new_item AS (
  INSERT INTO menu_items (category_id, name, price, is_veg, active, display_order)
  VALUES (34, 'Bhindi', 8.95, 1, 1, 6) RETURNING id
), grp AS (
  INSERT INTO modifier_groups (name, selection_type, min_select, max_select) VALUES ('Style', 'single', 1, 1) RETURNING id
), link AS (
  INSERT INTO menu_item_modifier_groups (menu_item_id, group_id, required, display_order)
  SELECT new_item.id, grp.id, 1, 1 FROM new_item, grp RETURNING group_id
)
INSERT INTO modifier_options (group_id, name, price_delta, display_order)
SELECT grp.id, opt.name, opt.price_delta, opt.display_order FROM grp, link,
  (VALUES ('Kurkure', 0, 1), ('Masala', 0, 2)) AS opt(name, price_delta, display_order);

INSERT INTO menu_items (category_id, name, price, is_veg, active, display_order) VALUES
  (34, 'Aubergine (Vankaya) Masala', 8.95, 1, 1, 7);

-- =====================================================================
-- 5. DINNER — NON-VEGETARIAN MAINS (category 27)
-- =====================================================================
UPDATE menu_items SET price = 12.95 WHERE id = 218; -- Haleem
UPDATE menu_items SET price = 13.95 WHERE id = 153; -- Kashmiri Rogan Josh
UPDATE menu_items SET price = 11.95 WHERE id = 220; -- Gongura Chicken
UPDATE menu_items SET price = 13.95 WHERE id = 221; -- Gongura Lamb
UPDATE menu_items SET price = 14.95 WHERE id = 222; -- Gongura Prawns
UPDATE menu_items SET price = 12.95 WHERE id = 157; -- Chicken Changezi
UPDATE menu_items SET active = 1, price = 14.95, name = 'Lamb Champaaran' WHERE id = 151; -- was inactive "Champaran Lamb"

-- Raju Gari Chicken Curry becomes the surviving item with a protein choice;
-- the separate Raju Gari Prawn Curry retires.
UPDATE menu_items SET name = 'Raju Gari Chicken/Prawn Curry', price = 12.95 WHERE id = 219;
WITH grp AS (
  INSERT INTO modifier_groups (name, selection_type, min_select, max_select) VALUES ('Protein', 'single', 1, 1) RETURNING id
), link AS (
  INSERT INTO menu_item_modifier_groups (menu_item_id, group_id, required, display_order)
  SELECT 219, id, 1, 1 FROM grp RETURNING group_id
)
INSERT INTO modifier_options (group_id, name, price_delta, display_order)
SELECT grp.id, opt.name, opt.price_delta, opt.display_order FROM grp, link,
  (VALUES ('Chicken', 0, 1), ('Prawn', 2.00, 2)) AS opt(name, price_delta, display_order);
UPDATE menu_items SET active = 0 WHERE id = 154; -- Raju Gari Prawn Curry

-- Tawa Chicken becomes the surviving (reactivated) item with a protein
-- choice; Tawa Lamb stays inactive, absorbed into the modifier.
UPDATE menu_items SET active = 1, name = 'Tawa Chicken/Lamb', price = 12.95 WHERE id = 156;
WITH grp AS (
  INSERT INTO modifier_groups (name, selection_type, min_select, max_select) VALUES ('Protein', 'single', 1, 1) RETURNING id
), link AS (
  INSERT INTO menu_item_modifier_groups (menu_item_id, group_id, required, display_order)
  SELECT 156, id, 1, 1 FROM grp RETURNING group_id
)
INSERT INTO modifier_options (group_id, name, price_delta, display_order)
SELECT grp.id, opt.name, opt.price_delta, opt.display_order FROM grp, link,
  (VALUES ('Chicken', 0, 1), ('Lamb', 2.00, 2)) AS opt(name, price_delta, display_order);

-- Chicken Tikka Masala becomes the surviving item with a style choice;
-- Butter Chicken retires.
UPDATE menu_items SET name = 'Chicken Tikka Masala / Butter Chicken', price = 10.95 WHERE id = 223;
WITH grp AS (
  INSERT INTO modifier_groups (name, selection_type, min_select, max_select) VALUES ('Style', 'single', 1, 1) RETURNING id
), link AS (
  INSERT INTO menu_item_modifier_groups (menu_item_id, group_id, required, display_order)
  SELECT 223, id, 1, 1 FROM grp RETURNING group_id
)
INSERT INTO modifier_options (group_id, name, price_delta, display_order)
SELECT grp.id, opt.name, opt.price_delta, opt.display_order FROM grp, link,
  (VALUES ('Chicken Tikka Masala', 0, 1), ('Butter Chicken', 0, 2)) AS opt(name, price_delta, display_order);
UPDATE menu_items SET active = 0 WHERE id = 160; -- Butter Chicken (absorbed above)

-- =====================================================================
-- 6. DINNER — BIRYANI (category 28)
-- =====================================================================
UPDATE menu_items SET active = 1, price = 18.95,
  description = 'Ask for a complimentary extra portion of rice.'
  WHERE id = 166; -- Nalli Gosht Biryani (was inactive)
UPDATE menu_items SET price = 12.95 WHERE id = 167; -- Lamb Dum Biryani
UPDATE menu_items SET price = 12.95 WHERE id = 168; -- Prawn Biryani
UPDATE menu_items SET price = 9.95  WHERE id = 169; -- Chicken Dum Biryani
UPDATE menu_items SET active = 1, price = 7.95 WHERE id = 172; -- Veg Biryani (was inactive)

INSERT INTO menu_items (category_id, name, price, is_veg, active, display_order) VALUES
  (28, 'Special Chicken Biryani', 10.95, 0, 1, 5);

-- Chicken 65 / Chicken Tikka / Chicken Fry Piece Biryani all retire —
-- replaced by the single "Special Chicken Biryani".
UPDATE menu_items SET active = 0 WHERE id IN (170, 224, 171);

-- =====================================================================
-- 7. DINNER — PREMIUM GRILLS (category 25)
-- =====================================================================
UPDATE menu_items SET price = 18.95 WHERE id = 131; -- The Royal Tandoori Platter
UPDATE menu_items SET price = 12.95 WHERE id = 209; -- Lamb Chops
UPDATE menu_items SET price = 13.95 WHERE id = 133; -- Bang Bang King Prawns
UPDATE menu_items SET price = 10.95, name = 'Sheekh Kebabs' WHERE id = 210; -- was "Seekh Kebab"
UPDATE menu_items SET price = 8.95  WHERE id = 211; -- Chicken Tikka
UPDATE menu_items SET price = 9.95  WHERE id = 212; -- Malai Tikka

-- =====================================================================
-- 8. DINNER — DESSERTS (category 33)
-- =====================================================================
UPDATE menu_items SET price = 5.95 WHERE id = 193; -- Apricot Delight
UPDATE menu_items SET active = 1, name = 'Kunafe' WHERE id = 194; -- was inactive "Kunafa" — price already matched
UPDATE menu_items SET active = 1 WHERE id = 195; -- Cheesecake (was inactive) — price already matched

UPDATE menu_items SET price = 3.95 WHERE id = 196; -- Gulab Jamun
WITH grp AS (
  INSERT INTO modifier_groups (name, selection_type, min_select, max_select) VALUES ('Add-on', 'multiple', 0, 1) RETURNING id
), link AS (
  INSERT INTO menu_item_modifier_groups (menu_item_id, group_id, required, display_order)
  SELECT 196, id, 0, 1 FROM grp RETURNING group_id
)
INSERT INTO modifier_options (group_id, name, price_delta, display_order)
SELECT grp.id, 'Add a scoop of ice cream', 2.00, 1 FROM grp, link;

-- =====================================================================
-- 9. DINNER — RICE (category 29)
-- =====================================================================
UPDATE menu_items SET price = 3.95 WHERE id = 227; -- Plain Rice
UPDATE menu_items SET price = 4.95 WHERE id = 228; -- Ragi Sangati
UPDATE menu_items SET active = 0 WHERE id IN (176, 175, 226, 225); -- Jeera / Bagaara / Mushroom / Pilau Rice — folded into Flavoured Rice, or retired (Pilau)

WITH new_item AS (
  INSERT INTO menu_items (category_id, name, price, is_veg, active, display_order)
  VALUES (29, 'Flavoured Rice', 4.95, 1, 1, 1) RETURNING id
), grp AS (
  INSERT INTO modifier_groups (name, selection_type, min_select, max_select) VALUES ('Flavour', 'single', 1, 1) RETURNING id
), link AS (
  INSERT INTO menu_item_modifier_groups (menu_item_id, group_id, required, display_order)
  SELECT new_item.id, grp.id, 1, 1 FROM new_item, grp RETURNING group_id
)
INSERT INTO modifier_options (group_id, name, price_delta, display_order)
SELECT grp.id, opt.name, opt.price_delta, opt.display_order FROM grp, link,
  (VALUES ('Lemon', 0, 1), ('Jeera', 0, 2), ('Bagara', 0, 3), ('Mushroom', 0, 4), ('Pudina', 0, 5)) AS opt(name, price_delta, display_order);

-- =====================================================================
-- 10. DINNER — NOODLES & FRIED RICE (category 30)
-- =====================================================================
UPDATE menu_items SET price = 6.95, name = 'Vegetable Noodles' WHERE id = 179; -- was "Vegetable Hakka Noodles"
UPDATE menu_items SET price = 7.95, name = 'Egg Noodles' WHERE id = 178;       -- was "Egg Hakka Noodles"
UPDATE menu_items SET price = 7.95, name = 'Chicken Noodles' WHERE id = 177;   -- was "Chicken Hakka Noodles"
UPDATE menu_items SET price = 8.95, name = 'Prawn Noodles' WHERE id = 229;     -- was "Prawn Hakka Noodles"
UPDATE menu_items SET price = 6.95 WHERE id = 230; -- Vegetable Fried Rice
UPDATE menu_items SET price = 7.95 WHERE id = 174; -- Egg Fried Rice
UPDATE menu_items SET price = 7.95 WHERE id = 173; -- Chicken Fried Rice
UPDATE menu_items SET price = 8.95 WHERE id = 231; -- Prawn Fried Rice

-- =====================================================================
-- 11. DINNER — BREADS (category 31)
-- =====================================================================
UPDATE menu_items SET price = 1.95, name = 'Naan' WHERE id = 181; -- was "Plain Naan"
UPDATE menu_items SET price = 3.95 WHERE id = 180; -- Kheema Naan
UPDATE menu_items SET price = 1.95 WHERE id = 182; -- Butter Naan
UPDATE menu_items SET price = 2.45 WHERE id = 183; -- Garlic Naan
UPDATE menu_items SET price = 2.45 WHERE id = 185; -- Chilli Garlic Naan
UPDATE menu_items SET price = 3.95 WHERE id = 184; -- Cheese Naan
UPDATE menu_items SET price = 1.95 WHERE id = 186; -- Tawa Roti
UPDATE menu_items SET price = 1.95 WHERE id = 188; -- Tandoori Roti
UPDATE menu_items SET active = 0 WHERE id = 192; -- Bread Basket (retired — not on new menu)

-- =====================================================================
-- 12. NEW CATEGORIES — Breakfast, Lunch Combos
--     Negative display_order puts them ahead of the existing 1–12 dinner
--     categories without renumbering anything.
-- =====================================================================
INSERT INTO menu_categories (name, display_order, color, active) VALUES
  ('Breakfast', -2, '#fbbf24', 1),
  ('Lunch Combos', -1, '#10b981', 1);

-- =====================================================================
-- 13. BREAKFAST (daily, 8am–12pm)
-- =====================================================================
INSERT INTO menu_items (category_id, name, price, is_veg, active, display_order)
SELECT (SELECT id FROM menu_categories WHERE name = 'Breakfast'), v.name, v.price, v.is_veg, 1, v.display_order
FROM (VALUES
  ('Vada (2)', 3.99, 1, 1),
  ('Idly (3)', 3.99, 1, 2),
  ('Plain Dosa', 3.99, 1, 3),
  ('Onion Dosa', 4.99, 1, 4),
  ('Ghee Cheese Dosa', 4.99, 1, 5),
  ('Kaju Dosa', 4.99, 1, 6),
  ('Masala Dosa', 4.99, 1, 7),
  ('Poori Masala (2)', 4.99, 1, 8),
  ('Pongal', 4.99, 1, 9),
  ('Khichdi', 4.99, 1, 10),
  ('Chapathi (2)', 4.99, 1, 11),
  ('Paratha (2)', 5.99, 1, 12),
  ('Mysore Masala Dosa', 6.99, 1, 13),
  ('Mysore Bonda (6)', 5.99, 1, 14),
  ('Vada + Chicken Curry', 5.99, 0, 15),
  ('Poori + Keema', 6.49, 0, 17),
  ('Poori + Chicken Curry', 5.99, 0, 18),
  ('Idly + Chicken Curry', 5.99, 0, 20),
  ('Idly + Lamb Curry', 6.49, 0, 21),
  ('Full Breakfast Combo', 6.99, 0, 22)
) AS v(name, price, is_veg, display_order);

-- Kottu Parotta: Egg/Chicken/Lamb, base Egg £4.99, Chicken +£1.00 (£5.99),
-- Lamb +£2.00 (£6.99).
WITH new_item AS (
  INSERT INTO menu_items (category_id, name, price, is_veg, active, display_order)
  VALUES ((SELECT id FROM menu_categories WHERE name = 'Breakfast'), 'Kottu Parotta', 4.99, 0, 1, 16) RETURNING id
), grp AS (
  INSERT INTO modifier_groups (name, selection_type, min_select, max_select) VALUES ('Protein', 'single', 1, 1) RETURNING id
), link AS (
  INSERT INTO menu_item_modifier_groups (menu_item_id, group_id, required, display_order)
  SELECT new_item.id, grp.id, 1, 1 FROM new_item, grp RETURNING group_id
)
INSERT INTO modifier_options (group_id, name, price_delta, display_order)
SELECT grp.id, opt.name, opt.price_delta, opt.display_order FROM grp, link,
  (VALUES ('Egg', 0, 1), ('Chicken', 1.00, 2), ('Lamb', 2.00, 3)) AS opt(name, price_delta, display_order);

-- Dosa + Paneer/Chicken/Lamb: base Paneer £6.99, Chicken £7.45 (+£0.46),
-- Lamb £7.99 (+£1.00).
WITH new_item AS (
  INSERT INTO menu_items (category_id, name, price, is_veg, active, display_order)
  VALUES ((SELECT id FROM menu_categories WHERE name = 'Breakfast'), 'Dosa + Paneer/Chicken/Lamb', 6.99, 0, 1, 19) RETURNING id
), grp AS (
  INSERT INTO modifier_groups (name, selection_type, min_select, max_select) VALUES ('Protein', 'single', 1, 1) RETURNING id
), link AS (
  INSERT INTO menu_item_modifier_groups (menu_item_id, group_id, required, display_order)
  SELECT new_item.id, grp.id, 1, 1 FROM new_item, grp RETURNING group_id
)
INSERT INTO modifier_options (group_id, name, price_delta, display_order)
SELECT grp.id, opt.name, opt.price_delta, opt.display_order FROM grp, link,
  (VALUES ('Paneer', 0, 1), ('Chicken', 0.46, 2), ('Lamb', 1.00, 3)) AS opt(name, price_delta, display_order);

-- =====================================================================
-- 14. LUNCH COMBOS (weekdays, 12noon–4pm) — every item £6.95 flat
-- =====================================================================
INSERT INTO menu_items (category_id, name, price, is_veg, active, display_order)
VALUES ((SELECT id FROM menu_categories WHERE name = 'Lunch Combos'), 'Spicy Bread Omelette', 6.95, 0, 1, 6);

WITH new_item AS (
  INSERT INTO menu_items (category_id, name, description, price, is_veg, active, display_order)
  VALUES ((SELECT id FROM menu_categories WHERE name = 'Lunch Combos'), 'Royal Wrap', 'Served with fries', 6.95, 0, 1, 1) RETURNING id
), grp AS (
  INSERT INTO modifier_groups (name, selection_type, min_select, max_select) VALUES ('Protein', 'single', 1, 1) RETURNING id
), link AS (
  INSERT INTO menu_item_modifier_groups (menu_item_id, group_id, required, display_order)
  SELECT new_item.id, grp.id, 1, 1 FROM new_item, grp RETURNING group_id
)
INSERT INTO modifier_options (group_id, name, price_delta, display_order)
SELECT grp.id, opt.name, opt.price_delta, opt.display_order FROM grp, link,
  (VALUES ('Chicken Tikka', 0, 1), ('Chicken 65', 0, 2), ('Paneer Tikka', 0, 3)) AS opt(name, price_delta, display_order);

WITH new_item AS (
  INSERT INTO menu_items (category_id, name, description, price, is_veg, active, display_order)
  VALUES ((SELECT id FROM menu_categories WHERE name = 'Lunch Combos'), 'Royal Curry Box', 'Served with rice', 6.95, 0, 1, 2) RETURNING id
), grp AS (
  INSERT INTO modifier_groups (name, selection_type, min_select, max_select) VALUES ('Choice', 'single', 1, 1) RETURNING id
), link AS (
  INSERT INTO menu_item_modifier_groups (menu_item_id, group_id, required, display_order)
  SELECT new_item.id, grp.id, 1, 1 FROM new_item, grp RETURNING group_id
)
INSERT INTO modifier_options (group_id, name, price_delta, display_order)
SELECT grp.id, opt.name, opt.price_delta, opt.display_order FROM grp, link,
  (VALUES ('Chicken Curry', 0, 1), ('Paneer Curry', 0, 2)) AS opt(name, price_delta, display_order);

WITH new_item AS (
  INSERT INTO menu_items (category_id, name, description, price, is_veg, active, display_order)
  VALUES ((SELECT id FROM menu_categories WHERE name = 'Lunch Combos'), 'Biryani Box', 'Served with raita', 6.95, 0, 1, 3) RETURNING id
), grp AS (
  INSERT INTO modifier_groups (name, selection_type, min_select, max_select) VALUES ('Choice', 'single', 1, 1) RETURNING id
), link AS (
  INSERT INTO menu_item_modifier_groups (menu_item_id, group_id, required, display_order)
  SELECT new_item.id, grp.id, 1, 1 FROM new_item, grp RETURNING group_id
)
INSERT INTO modifier_options (group_id, name, price_delta, display_order)
SELECT grp.id, opt.name, opt.price_delta, opt.display_order FROM grp, link,
  (VALUES ('Chicken Dum', 0, 1), ('Chicken Fry Piece', 0, 2), ('Veg', 0, 3)) AS opt(name, price_delta, display_order);

WITH new_item AS (
  INSERT INTO menu_items (category_id, name, description, price, is_veg, active, display_order)
  VALUES ((SELECT id FROM menu_categories WHERE name = 'Lunch Combos'), '65 / Tikka Biryani', 'Served with raita', 6.95, 0, 1, 4) RETURNING id
), grp AS (
  INSERT INTO modifier_groups (name, selection_type, min_select, max_select) VALUES ('Choice', 'single', 1, 1) RETURNING id
), link AS (
  INSERT INTO menu_item_modifier_groups (menu_item_id, group_id, required, display_order)
  SELECT new_item.id, grp.id, 1, 1 FROM new_item, grp RETURNING group_id
)
INSERT INTO modifier_options (group_id, name, price_delta, display_order)
SELECT grp.id, opt.name, opt.price_delta, opt.display_order FROM grp, link,
  (VALUES ('Chicken 65 Biryani', 0, 1), ('Chicken Tikka Biryani', 0, 2)) AS opt(name, price_delta, display_order);

WITH new_item AS (
  INSERT INTO menu_items (category_id, name, description, price, is_veg, active, display_order)
  VALUES ((SELECT id FROM menu_categories WHERE name = 'Lunch Combos'), 'Royal Frankie Roll', 'Served with fries', 6.95, 0, 1, 5) RETURNING id
), grp AS (
  INSERT INTO modifier_groups (name, selection_type, min_select, max_select) VALUES ('Protein', 'single', 1, 1) RETURNING id
), link AS (
  INSERT INTO menu_item_modifier_groups (menu_item_id, group_id, required, display_order)
  SELECT new_item.id, grp.id, 1, 1 FROM new_item, grp RETURNING group_id
)
INSERT INTO modifier_options (group_id, name, price_delta, display_order)
SELECT grp.id, opt.name, opt.price_delta, opt.display_order FROM grp, link,
  (VALUES ('Chicken Tikka', 0, 1), ('Chicken 65', 0, 2), ('Paneer Tikka', 0, 3)) AS opt(name, price_delta, display_order);

COMMIT;
