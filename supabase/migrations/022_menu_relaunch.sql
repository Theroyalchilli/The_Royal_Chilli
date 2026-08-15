-- Menu relaunch: replace category structure and item list with the new
-- collection/delivery menu (Excel-sourced), using proposed (marked-up)
-- pricing everywhere. Existing rows are updated in place (never deleted)
-- so order history keeps a valid menu_item_id; true drops are marked
-- inactive instead of removed.

-- 1. Rename/repurpose existing categories to the new structure
UPDATE menu_categories SET name = 'Soups', display_order = 1, color = '#3b82f6' WHERE id = 36;
UPDATE menu_categories SET name = 'Vegetarian Starters', display_order = 2, color = '#22c55e' WHERE id = 32;
UPDATE menu_categories SET name = 'Non-Vegetarian Starters', display_order = 3, color = '#ef4444' WHERE id = 26;
UPDATE menu_categories SET name = 'Premium Grills', display_order = 4, color = '#f97316' WHERE id = 25;
UPDATE menu_categories SET name = 'Vegetarian Mains', display_order = 5, color = '#16a34a' WHERE id = 34;
UPDATE menu_categories SET name = 'Non-Vegetarian Mains', display_order = 6, color = '#dc2626' WHERE id = 27;
UPDATE menu_categories SET name = 'Biryanis', display_order = 7, color = '#eab308' WHERE id = 28;
UPDATE menu_categories SET name = 'Noodles & Fried Rice', display_order = 8, color = '#ca8a04' WHERE id = 30;
UPDATE menu_categories SET name = 'Rice & Sides', display_order = 9, color = '#84cc16' WHERE id = 29;
UPDATE menu_categories SET name = 'Breads', display_order = 10, color = '#f59e0b' WHERE id = 31;
UPDATE menu_categories SET name = 'Desserts', display_order = 11, color = '#a855f7' WHERE id = 33;
UPDATE menu_categories SET name = 'Combos', display_order = 12, color = '#06b6d4' WHERE id = 35;

-- 2. Existing items: update in place (id preserved, order history intact)
UPDATE menu_items SET name = 'The Royal Tandoori Platter', price = 22.74, category_id = 25, is_veg = 0, active = 1, display_order = 1 WHERE id = 131; -- was: Royal Tandoori Platter
UPDATE menu_items SET name = 'Bang Bang King Prawns', price = 16.74, category_id = 25, is_veg = 0, active = 1, display_order = 3 WHERE id = 133; -- was: Bang Bang Prawns
UPDATE menu_items SET name = 'Pomfret Fry', price = 15.54, category_id = 26, is_veg = 0, active = 1, display_order = 1 WHERE id = 134; -- was: Pomfret Fry
UPDATE menu_items SET name = 'Lasooni Chilli Chicken Fry', price = 11.94, category_id = 26, is_veg = 0, active = 1, display_order = 3 WHERE id = 140; -- was: Lasooni Chilli Chicken Fry(Garlic Chilli)
UPDATE menu_items SET name = 'Curry Leaf Chicken Fry', price = 11.94, category_id = 26, is_veg = 0, active = 1, display_order = 4 WHERE id = 141; -- was: Karevepaku Chicken Fry (Curry Leaves)
UPDATE menu_items SET name = 'Chicken 65', price = 10.74, category_id = 26, is_veg = 0, active = 1, display_order = 5 WHERE id = 144; -- was: Chicken 65/Chilli/Majestic/Manchurian
UPDATE menu_items SET name = 'Kashmiri Rogan Josh', price = 17.94, category_id = 27, is_veg = 0, active = 1, display_order = 2 WHERE id = 153; -- was: Kashmiri Rogan Josh
UPDATE menu_items SET name = 'Raju Gari Prawn Curry', price = 17.94, category_id = 27, is_veg = 0, active = 1, display_order = 4 WHERE id = 154; -- was: Rajugari Prawn Curry
UPDATE menu_items SET name = 'Chicken Changezi', price = 15.54, category_id = 27, is_veg = 0, active = 1, display_order = 8 WHERE id = 157; -- was: Chicken Changezi
UPDATE menu_items SET name = 'Butter Chicken', price = 13.14, category_id = 27, is_veg = 0, active = 1, display_order = 10 WHERE id = 160; -- was: Butter Chicken / Chicken Tikka Masala
UPDATE menu_items SET name = 'Lamb Dum Biryani', price = 15.54, category_id = 28, is_veg = 0, active = 1, display_order = 1 WHERE id = 167; -- was: Lamb Dum Biryani
UPDATE menu_items SET name = 'Prawn Biryani', price = 15.54, category_id = 28, is_veg = 0, active = 1, display_order = 2 WHERE id = 168; -- was: Prawn Biryani
UPDATE menu_items SET name = 'Chicken Dum Biryani', price = 11.94, category_id = 28, is_veg = 0, active = 1, display_order = 3 WHERE id = 169; -- was: Chicken Dum Biryani
UPDATE menu_items SET name = 'Chicken 65 Biryani', price = 13.14, category_id = 28, is_veg = 0, active = 1, display_order = 4 WHERE id = 170; -- was: Special Chicken 65 Dum Biryani
UPDATE menu_items SET name = 'Chicken Fry Piece Biryani', price = 13.14, category_id = 28, is_veg = 0, active = 1, display_order = 6 WHERE id = 171; -- was: Fry Piece Chicken Biryani
UPDATE menu_items SET name = 'Jeera Rice', price = 5.94, category_id = 29, is_veg = 1, active = 1, display_order = 1 WHERE id = 176; -- was: Jeera Rice
UPDATE menu_items SET name = 'Bagaara Rice', price = 8.34, category_id = 29, is_veg = 1, active = 1, display_order = 3 WHERE id = 175; -- was: Bagaara Rice
UPDATE menu_items SET name = 'Vegetable Hakka Noodles', price = 8.34, category_id = 30, is_veg = 1, active = 1, display_order = 1 WHERE id = 179; -- was: Veg Hakka Noodles
UPDATE menu_items SET name = 'Egg Hakka Noodles', price = 9.54, category_id = 30, is_veg = 0, active = 1, display_order = 2 WHERE id = 178; -- was: Egg Hakka Noodles
UPDATE menu_items SET name = 'Chicken Hakka Noodles', price = 9.54, category_id = 30, is_veg = 0, active = 1, display_order = 3 WHERE id = 177; -- was: Chicken Hakka Noodles
UPDATE menu_items SET name = 'Egg Fried Rice', price = 9.54, category_id = 30, is_veg = 0, active = 1, display_order = 6 WHERE id = 174; -- was: Egg Fried Rice
UPDATE menu_items SET name = 'Chicken Fried Rice', price = 9.54, category_id = 30, is_veg = 0, active = 1, display_order = 7 WHERE id = 173; -- was: Chicken Fried Rice
UPDATE menu_items SET name = 'Bread Basket', price = 9.54, category_id = 31, is_veg = 1, active = 1, display_order = 1 WHERE id = 192; -- was: Special Bread Basket
UPDATE menu_items SET name = 'Plain Naan', price = 2.94, category_id = 31, is_veg = 1, active = 1, display_order = 2 WHERE id = 181; -- was: Plain Naan
UPDATE menu_items SET name = 'Butter Naan', price = 3.54, category_id = 31, is_veg = 1, active = 1, display_order = 3 WHERE id = 182; -- was: Butter Naan
UPDATE menu_items SET name = 'Garlic Naan', price = 4.74, category_id = 31, is_veg = 1, active = 1, display_order = 4 WHERE id = 183; -- was: Garlic Naan
UPDATE menu_items SET name = 'Chilli Garlic Naan', price = 4.74, category_id = 31, is_veg = 1, active = 1, display_order = 5 WHERE id = 185; -- was: Chilli Garlic Naan
UPDATE menu_items SET name = 'Kheema Naan', price = 5.94, category_id = 31, is_veg = 0, active = 1, display_order = 6 WHERE id = 180; -- was: Keema Naan
UPDATE menu_items SET name = 'Cheese Naan', price = 5.94, category_id = 31, is_veg = 1, active = 1, display_order = 7 WHERE id = 184; -- was: Cheese Naan
UPDATE menu_items SET name = 'Tawa Roti', price = 2.34, category_id = 31, is_veg = 1, active = 1, display_order = 8 WHERE id = 186; -- was: Roti
UPDATE menu_items SET name = 'Tandoori Roti', price = 3.54, category_id = 31, is_veg = 1, active = 1, display_order = 9 WHERE id = 188; -- was: Tandoori Roti
UPDATE menu_items SET name = 'Paneer Tikka Sizzler', price = 11.94, category_id = 32, is_veg = 1, active = 1, display_order = 2 WHERE id = 138; -- was: Paneer Tikka Sizzler
UPDATE menu_items SET name = 'Malai Broccoli', price = 11.94, category_id = 32, is_veg = 1, active = 1, display_order = 3 WHERE id = 139; -- was: Malai Broccoli
UPDATE menu_items SET name = 'Lotus Stem', price = 11.94, category_id = 32, is_veg = 1, active = 1, display_order = 4 WHERE id = 145; -- was: Crispy Lotus Stem
UPDATE menu_items SET name = 'Soya Chaap Sizzler', price = 11.94, category_id = 32, is_veg = 1, active = 1, display_order = 5 WHERE id = 137; -- was: Soya Chaap Sizzler
UPDATE menu_items SET name = 'Veg Manchurian', price = 10.74, category_id = 32, is_veg = 1, active = 1, display_order = 6 WHERE id = 148; -- was: Veg Manchurian
UPDATE menu_items SET name = 'Gobi Manchurian', price = 10.74, category_id = 32, is_veg = 1, active = 1, display_order = 7 WHERE id = 147; -- was: Gobi 65/Manchurian
UPDATE menu_items SET name = 'Apricot Delight', price = 7.14, category_id = 33, is_veg = 1, active = 1, display_order = 1 WHERE id = 193; -- was: Apricot Delight
UPDATE menu_items SET name = 'Gulab Jamun', price = 4.74, category_id = 33, is_veg = 1, active = 1, display_order = 2 WHERE id = 196; -- was: Gulab Jamoon
UPDATE menu_items SET name = 'Shahi Makhaana Curry', price = 15.54, category_id = 34, is_veg = 1, active = 1, display_order = 1 WHERE id = 161; -- was: Shahi Makhana Curry
UPDATE menu_items SET name = 'Paneer Lababdar', price = 15.54, category_id = 34, is_veg = 1, active = 1, display_order = 2 WHERE id = 163; -- was: Paneer Lababdar Curry
UPDATE menu_items SET name = 'Vegetarian Kofta Curry', price = 13.14, category_id = 34, is_veg = 1, active = 1, display_order = 3 WHERE id = 164; -- was: Vegetable Kofta Curry
UPDATE menu_items SET name = 'Dal Tadka', price = 8.34, category_id = 34, is_veg = 1, active = 1, display_order = 4 WHERE id = 165; -- was: Dal Tadka
UPDATE menu_items SET name = 'Biryani Combo', price = 14.95, category_id = 35, is_veg = 0, active = 1, display_order = 1 WHERE id = 198; -- was: Starter + Biryani + Soft Drink
UPDATE menu_items SET name = 'Chicken Biriyani for Two', price = 18.95, category_id = 35, is_veg = 0, active = 1, display_order = 4 WHERE id = 201; -- was: Family (2) — Chicken Biryani
UPDATE menu_items SET name = 'Lamb Biryani for Two', price = 23.95, category_id = 35, is_veg = 0, active = 1, display_order = 5 WHERE id = 202; -- was: Family (2) — Lamb Biryani
UPDATE menu_items SET name = 'Chicken Family Pack', price = 24.95, category_id = 35, is_veg = 0, active = 1, display_order = 6 WHERE id = 205; -- was: Family Pack(4) — Chicken Biryani
UPDATE menu_items SET name = 'Lamb Family Pack', price = 28.95, category_id = 35, is_veg = 0, active = 1, display_order = 7 WHERE id = 206; -- was: Family Pack(4) — Lamb Biryani

-- 3. New items
INSERT INTO menu_items (category_id, name, price, is_veg, display_order) VALUES
  (25, 'Lamb Chops', 17.94, 0, 2),
  (25, 'Seekh Kebab', 13.14, 0, 4),
  (25, 'Chicken Tikka', 10.74, 0, 5),
  (25, 'Malai Tikka', 11.94, 0, 6),
  (26, 'Fish Pakoda', 11.94, 0, 2),
  (26, 'Chilli Chicken', 10.74, 0, 6),
  (26, 'Chicken Pakoda', 10.74, 0, 7),
  (26, 'Chicken Majestic', 10.74, 0, 8),
  (26, 'Chicken Manchurian', 10.74, 0, 9),
  (27, 'Haleem', 15.54, 0, 1),
  (27, 'Raju Gari Chicken Curry', 15.54, 0, 3),
  (27, 'Gongura Chicken', 15.54, 0, 5),
  (27, 'Gongura Lamb', 17.94, 0, 6),
  (27, 'Gongura Prawns', 19.14, 0, 7),
  (27, 'Chicken Tikka Masala', 13.14, 0, 9),
  (28, 'Chicken Tikka Biryani', 13.14, 0, 5),
  (29, 'Pilau Rice', 5.94, 1, 2),
  (29, 'Mushroom Rice', 5.94, 1, 4),
  (29, 'Plain Rice', 4.74, 1, 5),
  (29, 'Ragi Sangati', 5.94, 1, 6),
  (30, 'Prawn Hakka Noodles', 10.74, 0, 4),
  (30, 'Vegetable Fried Rice', 8.34, 1, 5),
  (30, 'Prawn Fried Rice', 10.74, 0, 8),
  (32, 'Stuffed Bajji', 8.34, 1, 1),
  (35, 'Noodles Combo', 14.95, 0, 2),
  (35, 'Fried Rice Combo', 14.95, 0, 3),
  (36, 'Vegetarian Sweet Corn Soup', 5.94, 1, 1),
  (36, 'Vegetarian Lemon Coriander Soup', 5.94, 1, 2),
  (36, 'Vegetarian Hot & Sour Soup', 5.94, 1, 3),
  (36, 'Vegetarian Manchow Soup', 7.14, 1, 4),
  (36, 'Chicken Sweet Corn Soup', 7.14, 0, 5),
  (36, 'Chicken Hot & Sour Soup', 7.14, 0, 6),
  (36, 'Chicken Manchow Soup', 8.34, 0, 7);

-- 4. Discontinued items: mark inactive (never delete, preserves order history).
--    The 4 combo/family-pack items with no new equivalent also move to the
--    Combos category (35) since their old categories (37, 38) are removed below.
UPDATE menu_items SET active = 0 WHERE id = 132; -- Pistachio Lamb Chops
UPDATE menu_items SET active = 0 WHERE id = 135; -- Veg Platter
UPDATE menu_items SET active = 0 WHERE id = 136; -- Angara Gobi Florets
UPDATE menu_items SET active = 0 WHERE id = 142; -- Lamb Ghee Roast
UPDATE menu_items SET active = 0 WHERE id = 143; -- Chicken Lollipop
UPDATE menu_items SET active = 0 WHERE id = 146; -- Crispy Corn Niblets
UPDATE menu_items SET active = 0 WHERE id = 149; -- Stuffed Chilli
UPDATE menu_items SET active = 0 WHERE id = 150; -- Bheja Fry with 2 Rotis
UPDATE menu_items SET active = 0 WHERE id = 151; -- Champaran Lamb
UPDATE menu_items SET active = 0 WHERE id = 152; -- Nellore Chepala Pulusu(Fish Curry) + Steam Rice
UPDATE menu_items SET active = 0 WHERE id = 155; -- Tawa Lamb
UPDATE menu_items SET active = 0 WHERE id = 156; -- Tawa Chicken
UPDATE menu_items SET active = 0 WHERE id = 158; -- Natu Kodi Chicken
UPDATE menu_items SET active = 0 WHERE id = 159; -- Raagi Sankati with Chicken Curry
UPDATE menu_items SET active = 0 WHERE id = 162; -- 24 Karot Malai Palak Curry
UPDATE menu_items SET active = 0 WHERE id = 166; -- Nalli Gosht Biryani
UPDATE menu_items SET active = 0 WHERE id = 172; -- Veg Biryani
UPDATE menu_items SET active = 0 WHERE id = 187; -- Butter Roti
UPDATE menu_items SET active = 0 WHERE id = 189; -- Dosa (Veg)
UPDATE menu_items SET active = 0 WHERE id = 190; -- Dosa (Chicken)
UPDATE menu_items SET active = 0 WHERE id = 191; -- Dosa (Mutton)
UPDATE menu_items SET active = 0 WHERE id = 194; -- Kunafa
UPDATE menu_items SET active = 0 WHERE id = 195; -- Cheesecake
UPDATE menu_items SET active = 0 WHERE id = 197; -- Starter + Main + Bagara Rice/Naan + Soft Drink
UPDATE menu_items SET active = 0 WHERE id = 199; -- Seafood Starter + Seafood Main + Bagara Rice/Naan + Soft Drink
UPDATE menu_items SET active = 0, category_id = 35 WHERE id = 200; -- Family (2) — Veg Biryani
UPDATE menu_items SET active = 0, category_id = 35 WHERE id = 203; -- Family (2) — Prawns Biryani
UPDATE menu_items SET active = 0, category_id = 35 WHERE id = 204; -- Family Pack(4) — Veg Biryani
UPDATE menu_items SET active = 0, category_id = 35 WHERE id = 207; -- Family Pack(4) — Prawns Biryani

-- 5. Remove the now-empty, superseded category rows
DELETE FROM menu_categories WHERE id IN (37, 38);
