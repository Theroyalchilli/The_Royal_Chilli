-- =============================================================
-- Royal Chilli POS — Full Menu Seed
-- Run this in Supabase SQL Editor to import the full Royal Chilli menu.
-- Generated from The-Royal-Chilli/content.json (110 items, 16 categories)
-- =============================================================

-- -------------------------------------------------------------
-- 1. Clear existing menu data (order matters due to FK constraints)
-- -------------------------------------------------------------
DELETE FROM order_items;
DELETE FROM menu_items;
DELETE FROM menu_categories;

-- -------------------------------------------------------------
-- 2. Insert menu categories
-- -------------------------------------------------------------
INSERT INTO menu_categories (name, display_order, color, active) VALUES
('Soups',            1,  '#06b6d4', 1),
('Appetisers',       2,  '#84cc16', 1),
('Veg Starters',     3,  '#22c55e', 1),
('Royal Veg',        4,  '#a3e635', 1),
('Veg Mains',        5,  '#10b981', 1),
('Veg Combos',       6,  '#34d399', 1),
('Non-Veg Starters', 7,  '#f97316', 1),
('Royal Non-Veg',    8,  '#ef4444', 1),
('Non-Veg Mains',    9,  '#dc2626', 1),
('Non-Veg Combos',   10, '#f87171', 1),
('Biryanis',         11, '#eab308', 1),
('Royal Combos',     12, '#f59e0b', 1),
('Rice & Noodles',   13, '#8b5cf6', 1),
('Breads',           14, '#d97706', 1),
('Rice & Sides',     15, '#a78bfa', 1),
('Desserts',         16, '#ec4899', 1);

-- -------------------------------------------------------------
-- 3. Insert menu items
-- -------------------------------------------------------------

-- ── Soups (4 items) ──────────────────────────────────────────
INSERT INTO menu_items (category_id, name, description, price, is_veg, active, display_order) VALUES
((SELECT id FROM menu_categories WHERE name = 'Soups'), 'Vegetable Sweet Corn Soup', 'Sweetcorn and garden vegetables in a lightly seasoned broth.', 5.95, 1, 1, 1),
((SELECT id FROM menu_categories WHERE name = 'Soups'), 'Chicken Sweet Corn Soup', 'Tender chicken and sweetcorn in a smooth, gently seasoned broth.', 6.95, 0, 1, 2),
((SELECT id FROM menu_categories WHERE name = 'Soups'), 'Vegetable Manchow Soup', 'Hot and tangy vegetable soup topped with crispy noodles.', 5.95, 1, 1, 3),
((SELECT id FROM menu_categories WHERE name = 'Soups'), 'Chicken Manchow Soup', 'Spicy chicken and vegetable soup with garlic, chilli and crispy noodles.', 6.95, 0, 1, 4);

-- ── Appetisers (7 items) ─────────────────────────────────────
INSERT INTO menu_items (category_id, name, description, price, is_veg, active, display_order) VALUES
((SELECT id FROM menu_categories WHERE name = 'Appetisers'), 'Masala Papad', 'Crisp papad topped with onion, tomato, chilli and tangy seasoning.', 3.95, 1, 1, 1),
((SELECT id FROM menu_categories WHERE name = 'Appetisers'), 'Plain Papad', 'Crisp roasted or fried papad served with house chutneys.', 2.50, 1, 1, 2),
((SELECT id FROM menu_categories WHERE name = 'Appetisers'), 'Chilli Garlic Mogo', 'Crispy cassava tossed with garlic, chilli, peppers and spring onion.', 6.95, 1, 1, 3),
((SELECT id FROM menu_categories WHERE name = 'Appetisers'), 'Vegetable Spring Rolls', 'Crispy rolls filled with vegetables and served with sweet chilli sauce.', 5.95, 1, 1, 4),
((SELECT id FROM menu_categories WHERE name = 'Appetisers'), 'Onion Pakoda', 'Crispy onion fritters seasoned with chilli and Indian spices.', 5.95, 1, 1, 5),
((SELECT id FROM menu_categories WHERE name = 'Appetisers'), 'Cut Mirchi', 'Battered green chillies fried until crisp and finished with tangy seasoning.', 5.95, 1, 1, 6),
((SELECT id FROM menu_categories WHERE name = 'Appetisers'), 'Samosa Chaat', 'Crushed samosas with chickpeas, yoghurt and tangy chutneys.', 5.95, 1, 1, 7);

-- ── Veg Starters (7 items) ───────────────────────────────────
INSERT INTO menu_items (category_id, name, description, price, is_veg, active, display_order) VALUES
((SELECT id FROM menu_categories WHERE name = 'Veg Starters'), 'Paneer Choice', 'Paneer 65, Chilli Paneer, Manchurian, Tikka or Pakoda.', 8.95, 1, 1, 1),
((SELECT id FROM menu_categories WHERE name = 'Veg Starters'), 'Gobi Choice', 'Gobi 65, Chilli Gobi, Manchurian or Crispy Gobi.', 7.95, 1, 1, 2),
((SELECT id FROM menu_categories WHERE name = 'Veg Starters'), 'Mushroom Choice', 'Chilli Mushroom, Mushroom 65, Pepper or Manchurian.', 8.95, 1, 1, 3),
((SELECT id FROM menu_categories WHERE name = 'Veg Starters'), 'Crispy Corn', 'Golden sweetcorn tossed with garlic, chilli, pepper and curry leaves.', 5.95, 1, 1, 4),
((SELECT id FROM menu_categories WHERE name = 'Veg Starters'), 'Vegetable Manchurian', 'Crispy vegetable dumplings tossed with garlic, chilli and sauce.', 8.95, 1, 1, 5),
((SELECT id FROM menu_categories WHERE name = 'Veg Starters'), 'Tandoori Paneer Tikka', 'Paneer, onion and peppers marinated with yoghurt and Kashmiri chilli.', 9.95, 1, 1, 6),
((SELECT id FROM menu_categories WHERE name = 'Veg Starters'), 'Bhindi Kurkuri', 'Crispy okra seasoned with gram flour, chilli, cumin and mango powder.', 8.95, 1, 1, 7);

-- ── Royal Veg (7 items) ──────────────────────────────────────
INSERT INTO menu_items (category_id, name, description, price, is_veg, active, display_order) VALUES
((SELECT id FROM menu_categories WHERE name = 'Royal Veg'), 'Gutti Vankaya Curry', 'Baby aubergines stuffed with peanut, sesame, coconut and Andhra spices.', 9.95, 1, 1, 1),
((SELECT id FROM menu_categories WHERE name = 'Royal Veg'), 'Gongura Paneer', 'Paneer cooked with tangy sorrel leaves, garlic, chilli and Andhra spices.', 9.95, 1, 1, 2),
((SELECT id FROM menu_categories WHERE name = 'Royal Veg'), 'Paneer Ghee Roast', 'Paneer tossed in a rich Mangalorean chilli, spice and ghee masala.', 9.95, 1, 1, 3),
((SELECT id FROM menu_categories WHERE name = 'Royal Veg'), 'Tandoori Paneer Platter', 'Paneer tikka, hariyali paneer and malai paneer cooked in the tandoor.', 12.95, 1, 1, 4),
((SELECT id FROM menu_categories WHERE name = 'Royal Veg'), 'Chilli Mushroom Pepper Fry', 'Mushrooms stir-fried with black pepper, curry leaves, garlic and chilli.', 7.95, 1, 1, 5),
((SELECT id FROM menu_categories WHERE name = 'Royal Veg'), 'Crispy Lotus Stem', 'Crispy lotus stem tossed in a sweet, spicy and tangy chilli glaze.', 9.95, 1, 1, 6),
((SELECT id FROM menu_categories WHERE name = 'Royal Veg'), 'Tandoori Broccoli', 'Broccoli marinated with yoghurt, mustard, chilli and tandoori spices.', 8.95, 1, 1, 7);

-- ── Veg Mains (9 items) ──────────────────────────────────────
INSERT INTO menu_items (category_id, name, description, price, is_veg, active, display_order) VALUES
((SELECT id FROM menu_categories WHERE name = 'Veg Mains'), 'Paneer Butter Masala', 'Paneer simmered in a creamy tomato, butter and mild spice sauce.', 9.95, 1, 1, 1),
((SELECT id FROM menu_categories WHERE name = 'Veg Mains'), 'Kadai Paneer', 'Paneer with peppers, onion, tomato and freshly ground kadai spices.', 9.95, 1, 1, 2),
((SELECT id FROM menu_categories WHERE name = 'Veg Mains'), 'Palak Paneer', 'Paneer gently cooked in a smooth spinach, garlic and tomato sauce.', 9.95, 1, 1, 3),
((SELECT id FROM menu_categories WHERE name = 'Veg Mains'), 'Paneer Tikka Masala', 'Char-grilled paneer in a rich tomato, onion and cream sauce.', 9.95, 1, 1, 4),
((SELECT id FROM menu_categories WHERE name = 'Veg Mains'), 'Vegetable Korma', 'Mixed vegetables cooked with coconut, cashew and aromatic spices.', 9.95, 1, 1, 5),
((SELECT id FROM menu_categories WHERE name = 'Veg Mains'), 'Vegetable Chettinad', 'Seasonal vegetables with coconut, black pepper, fennel and curry leaves.', 9.95, 1, 1, 6),
((SELECT id FROM menu_categories WHERE name = 'Veg Mains'), 'Dal Tadka', 'Yellow lentils tempered with cumin, garlic, chilli and ghee.', 6.95, 1, 1, 7),
((SELECT id FROM menu_categories WHERE name = 'Veg Mains'), 'Dal Makhani', 'Black lentils slow-cooked with tomato, butter and cream.', 7.95, 1, 1, 8),
((SELECT id FROM menu_categories WHERE name = 'Veg Mains'), 'Chana Masala', 'Chickpeas cooked with onion, tomato, ginger and Punjabi spices.', 7.95, 1, 1, 9);

-- ── Veg Combos (2 items) ─────────────────────────────────────
INSERT INTO menu_items (category_id, name, description, price, is_veg, active, display_order) VALUES
((SELECT id FROM menu_categories WHERE name = 'Veg Combos'), 'Royal Vegetarian Combo', 'One veg starter + one veg main, served with jeera rice, plain naan and raita.', 19.95, 1, 1, 1),
((SELECT id FROM menu_categories WHERE name = 'Veg Combos'), 'Vegetarian Sharing Combo', 'Two starters, two mains, dal tadka, rice, two naans and raita for two diners.', 34.95, 1, 1, 2);

-- ── Non-Veg Starters (7 items) ───────────────────────────────
INSERT INTO menu_items (category_id, name, description, price, is_veg, active, display_order) VALUES
((SELECT id FROM menu_categories WHERE name = 'Non-Veg Starters'), 'Chicken Choice', 'Chicken 65, Chilli, Majestic, Lollipop, Manchurian, Pakoda or Tikka.', 8.95, 0, 1, 1),
((SELECT id FROM menu_categories WHERE name = 'Non-Veg Starters'), 'Fish Choice', 'Fish Pakoda, Apollo Fish Fry, Fish 65 or Chilli Fish.', 9.95, 0, 1, 2),
((SELECT id FROM menu_categories WHERE name = 'Non-Veg Starters'), 'Lamb Choice', 'Lamb Ghee Roast, Chukka, Pepper, Seekh Kebab or Chops.', 9.95, 0, 1, 3),
((SELECT id FROM menu_categories WHERE name = 'Non-Veg Starters'), 'Prawn Choice', 'Pepper, Chilli Garlic, Prawn 65 or Butter Garlic Prawns.', 10.95, 0, 1, 4),
((SELECT id FROM menu_categories WHERE name = 'Non-Veg Starters'), 'Chicken Tangdi Kebab', 'Chicken drumsticks marinated with yoghurt, ginger, garlic and spices.', 9.95, 0, 1, 5),
((SELECT id FROM menu_categories WHERE name = 'Non-Veg Starters'), 'Malai Chicken Tikka', 'Tender chicken marinated with cream, cardamom and mild spices.', 9.95, 0, 1, 6),
((SELECT id FROM menu_categories WHERE name = 'Non-Veg Starters'), 'Lamb Seekh Kebab', 'Minced lamb skewers seasoned with herbs and cooked over charcoal.', 10.95, 0, 1, 7);

-- ── Royal Non-Veg (16 items) ─────────────────────────────────
INSERT INTO menu_items (category_id, name, description, price, is_veg, active, display_order) VALUES
((SELECT id FROM menu_categories WHERE name = 'Royal Non-Veg'), 'Chicken Platter', 'Chicken tikka, wings, tangdi kebab and house chicken kebab.', 14.50, 0, 1, 1),
((SELECT id FROM menu_categories WHERE name = 'Royal Non-Veg'), 'Bheja Fry', 'Tender lamb brain cooked with onion, chilli and traditional spices.', 12.95, 0, 1, 2),
((SELECT id FROM menu_categories WHERE name = 'Royal Non-Veg'), 'Liver Fry', 'Spiced liver stir-fried with onion, curry leaves and black pepper.', 8.95, 0, 1, 3),
((SELECT id FROM menu_categories WHERE name = 'Royal Non-Veg'), 'Natu Kodi Fry', 'Country-style chicken fried with chilli, curry leaves and Andhra spices.', 9.95, 0, 1, 4),
((SELECT id FROM menu_categories WHERE name = 'Royal Non-Veg'), 'Pistachio Lamb Chops', 'Char-grilled lamb chops finished with aromatic spices and pistachio.', 14.95, 0, 1, 5),
((SELECT id FROM menu_categories WHERE name = 'Royal Non-Veg'), 'Haleem', 'Slow-cooked meat, lentils and wheat blended with Hyderabadi spices.', 12.95, 0, 1, 6),
((SELECT id FROM menu_categories WHERE name = 'Royal Non-Veg'), 'Andhra Chicken Curry', 'Chicken slow-cooked with onion, tomato, curry leaves and Andhra spices.', 9.95, 0, 1, 7),
((SELECT id FROM menu_categories WHERE name = 'Royal Non-Veg'), 'Gongura Chicken', 'Chicken cooked with tangy sorrel leaves, garlic and green chilli.', 9.95, 0, 1, 8),
((SELECT id FROM menu_categories WHERE name = 'Royal Non-Veg'), 'Tiger Prawns Masala Fry', 'Tiger prawns tossed in onion, tomato, chilli and curry-leaf masala.', 14.95, 0, 1, 9),
((SELECT id FROM menu_categories WHERE name = 'Royal Non-Veg'), 'Paya', 'Slow-cooked lamb trotters in a rich and aromatic spiced gravy.', 12.95, 0, 1, 10),
((SELECT id FROM menu_categories WHERE name = 'Royal Non-Veg'), 'King Fish Fry', 'King fish marinated with chilli, turmeric, ginger and garlic.', 12.95, 0, 1, 11),
((SELECT id FROM menu_categories WHERE name = 'Royal Non-Veg'), 'Pomfret Fry', 'Whole pomfret marinated in coastal spices and fried until crisp.', 14.95, 0, 1, 12),
((SELECT id FROM menu_categories WHERE name = 'Royal Non-Veg'), 'Lemon Butter Fish', 'Fish fillet finished with lemon, butter, garlic and fresh herbs.', 15.95, 0, 1, 13),
((SELECT id FROM menu_categories WHERE name = 'Royal Non-Veg'), 'Grilled Sea Bass', 'Sea bass grilled with citrus, garlic, herbs and mild Indian spices.', 15.95, 0, 1, 14),
((SELECT id FROM menu_categories WHERE name = 'Royal Non-Veg'), 'Volcano Garlic Prawns', 'Prawns cooked in an intense garlic, chilli and butter glaze.', 14.95, 0, 1, 15),
((SELECT id FROM menu_categories WHERE name = 'Royal Non-Veg'), 'Gongura Lamb', 'Tender lamb cooked with tangy sorrel leaves and Andhra spices.', 10.95, 0, 1, 16),
((SELECT id FROM menu_categories WHERE name = 'Royal Non-Veg'), 'Gongura Prawns', 'Prawns cooked with gongura leaves, garlic, chilli and coastal spices.', 11.95, 0, 1, 17);

-- ── Non-Veg Mains (8 items) ──────────────────────────────────
INSERT INTO menu_items (category_id, name, description, price, is_veg, active, display_order) VALUES
((SELECT id FROM menu_categories WHERE name = 'Non-Veg Mains'), 'Chicken Curry Choice', 'Chicken Tikka Masala, Butter Chicken, Kadai Chicken or Bhuna.', 9.95, 0, 1, 1),
((SELECT id FROM menu_categories WHERE name = 'Non-Veg Mains'), 'Lamb Curry Choice', 'Lamb Kadai, Telangana Mamsam, Railway Curry or Rogan Josh.', 10.95, 0, 1, 2),
((SELECT id FROM menu_categories WHERE name = 'Non-Veg Mains'), 'Prawn Curry Choice', 'Prawn Kadai, Masala, Chilli Garlic or Tikka Masala.', 10.95, 0, 1, 3),
((SELECT id FROM menu_categories WHERE name = 'Non-Veg Mains'), 'King Fish Curry', 'King fish simmered in a rich onion, tomato, spice and tamarind curry.', 12.95, 0, 1, 4),
((SELECT id FROM menu_categories WHERE name = 'Non-Veg Mains'), 'Chicken Chettinad', 'Chicken cooked with coconut, black pepper, fennel and curry leaves.', 10.95, 0, 1, 5),
((SELECT id FROM menu_categories WHERE name = 'Non-Veg Mains'), 'Andhra Mutton Curry', 'Tender mutton slow-cooked with onion, tomato, pepper and Andhra spices.', 11.95, 0, 1, 6),
((SELECT id FROM menu_categories WHERE name = 'Non-Veg Mains'), 'Mangalore Prawn Curry', 'Prawns simmered with coconut, coriander, tamarind and curry leaves.', 12.95, 0, 1, 7),
((SELECT id FROM menu_categories WHERE name = 'Non-Veg Mains'), 'Nellore Fish Pulusu', 'Fish cooked in a tangy tamarind, raw mango and Andhra chilli gravy.', 12.95, 0, 1, 8);

-- ── Non-Veg Combos (2 items) ─────────────────────────────────
INSERT INTO menu_items (category_id, name, description, price, is_veg, active, display_order) VALUES
((SELECT id FROM menu_categories WHERE name = 'Non-Veg Combos'), 'Royal Chicken Combo', 'One chicken starter + one chicken main, served with jeera rice, plain naan, raita and a special dessert.', 22.95, 0, 1, 1),
((SELECT id FROM menu_categories WHERE name = 'Non-Veg Combos'), 'Royal Lamb Combo', 'One lamb starter + one lamb main, served with jeera rice, plain naan, raita and a special dessert.', 26.95, 0, 1, 2);

-- ── Biryanis (7 items) ───────────────────────────────────────
INSERT INTO menu_items (category_id, name, description, price, is_veg, active, display_order) VALUES
((SELECT id FROM menu_categories WHERE name = 'Biryanis'), 'Hyderabadi Chicken Dum Biryani', 'Marinated chicken and basmati rice dum-cooked with saffron and spices.', 7.95, 0, 1, 1),
((SELECT id FROM menu_categories WHERE name = 'Biryanis'), 'Chicken Fry-Piece Biryani', 'Spiced fried chicken layered with aromatic rice and biryani masala.', 8.95, 0, 1, 2),
((SELECT id FROM menu_categories WHERE name = 'Biryanis'), 'Hyderabadi Lamb Dum Biryani', 'Tender lamb and basmati rice slow-cooked with saffron and spices.', 10.95, 0, 1, 3),
((SELECT id FROM menu_categories WHERE name = 'Biryanis'), 'Prawn Biryani', 'Prawns layered with basmati rice, saffron and coastal spices.', 12.95, 0, 1, 4),
((SELECT id FROM menu_categories WHERE name = 'Biryanis'), 'Fish Biryani', 'Marinated fish layered with basmati rice and balanced spices.', 12.95, 0, 1, 5),
((SELECT id FROM menu_categories WHERE name = 'Biryanis'), 'Vegetable Dum Biryani', 'Seasonal vegetables and basmati rice dum-cooked with saffron.', 7.95, 1, 1, 6),
((SELECT id FROM menu_categories WHERE name = 'Biryanis'), 'Paneer Biryani', 'Spiced paneer and vegetables layered with fragrant basmati rice.', 8.95, 1, 1, 7);

-- ── Royal Combos (5 items) ───────────────────────────────────
INSERT INTO menu_items (category_id, name, description, price, is_veg, active, display_order) VALUES
((SELECT id FROM menu_categories WHERE name = 'Royal Combos'), 'Chicken Biryani Combo', 'Chicken dum biryani with chicken 65, raita and a soft drink.', 15.95, 0, 1, 1),
((SELECT id FROM menu_categories WHERE name = 'Royal Combos'), 'Lamb Biryani Combo', 'Lamb dum biryani with lamb starter, raita and a soft drink.', 18.95, 0, 1, 2),
((SELECT id FROM menu_categories WHERE name = 'Royal Combos'), 'Vegetarian Biryani Combo', 'Vegetable biryani with crispy corn, raita and a soft drink.', 12.95, 1, 1, 3),
((SELECT id FROM menu_categories WHERE name = 'Royal Combos'), 'Family Chicken Biryani Combo', 'Family chicken biryani, chicken starter, two naans, raita and salan.', 34.95, 0, 1, 4),
((SELECT id FROM menu_categories WHERE name = 'Royal Combos'), 'Family Lamb Biryani Combo', 'Family lamb biryani, lamb starter, two naans, raita and salan.', 44.95, 0, 1, 5);

-- ── Rice & Noodles (4 items) ─────────────────────────────────
INSERT INTO menu_items (category_id, name, description, price, is_veg, active, display_order) VALUES
((SELECT id FROM menu_categories WHERE name = 'Rice & Noodles'), 'Vegetable Fried Rice or Noodles', 'Wok-tossed rice or noodles with vegetables and light seasoning.', 6.95, 1, 1, 1),
((SELECT id FROM menu_categories WHERE name = 'Rice & Noodles'), 'Egg Fried Rice or Noodles', 'Wok-tossed rice or noodles with egg and vegetables.', 7.95, 0, 1, 2),
((SELECT id FROM menu_categories WHERE name = 'Rice & Noodles'), 'Chicken Fried Rice or Noodles', 'Wok-tossed rice or noodles with chicken and vegetables.', 8.95, 0, 1, 3),
((SELECT id FROM menu_categories WHERE name = 'Rice & Noodles'), 'Prawn Fried Rice or Noodles', 'Wok-tossed rice or noodles with prawns and vegetables.', 9.95, 0, 1, 4);

-- ── Breads (9 items) ─────────────────────────────────────────
INSERT INTO menu_items (category_id, name, description, price, is_veg, active, display_order) VALUES
((SELECT id FROM menu_categories WHERE name = 'Breads'), 'Plain Naan', 'Soft traditional bread freshly baked in the tandoor.', 2.50, 1, 1, 1),
((SELECT id FROM menu_categories WHERE name = 'Breads'), 'Butter Naan', 'Tandoor-baked naan brushed with melted butter.', 2.95, 1, 1, 2),
((SELECT id FROM menu_categories WHERE name = 'Breads'), 'Garlic Naan', 'Fresh naan topped with garlic, butter and coriander.', 3.50, 1, 1, 3),
((SELECT id FROM menu_categories WHERE name = 'Breads'), 'Chilli Garlic Naan', 'Naan finished with garlic, chilli, coriander and butter.', 3.95, 1, 1, 4),
((SELECT id FROM menu_categories WHERE name = 'Breads'), 'Cheese Naan', 'Soft naan filled with melted cheese.', 4.50, 1, 1, 5),
((SELECT id FROM menu_categories WHERE name = 'Breads'), 'Keema Naan', 'Naan filled with seasoned minced lamb and baked in the tandoor.', 4.95, 0, 1, 6),
((SELECT id FROM menu_categories WHERE name = 'Breads'), 'Tandoori Roti', 'Wholewheat flatbread baked in the tandoor.', 2.50, 1, 1, 7),
((SELECT id FROM menu_categories WHERE name = 'Breads'), 'Butter Roti', 'Tandoori roti brushed with melted butter.', 2.95, 1, 1, 8),
((SELECT id FROM menu_categories WHERE name = 'Breads'), 'Chapati', 'Soft wholewheat flatbread cooked on a hot griddle.', 2.95, 1, 1, 9);

-- ── Rice & Sides (9 items) ───────────────────────────────────
INSERT INTO menu_items (category_id, name, description, price, is_veg, active, display_order) VALUES
((SELECT id FROM menu_categories WHERE name = 'Rice & Sides'), 'Steamed Basmati Rice', 'Fragrant basmati rice steamed until light and fluffy.', 3.50, 1, 1, 1),
((SELECT id FROM menu_categories WHERE name = 'Rice & Sides'), 'Jeera Rice', 'Basmati rice tempered with cumin seeds and aromatic spices.', 4.50, 1, 1, 2),
((SELECT id FROM menu_categories WHERE name = 'Rice & Sides'), 'Pilau Rice', 'Lightly spiced basmati rice cooked with whole spices.', 4.95, 1, 1, 3),
((SELECT id FROM menu_categories WHERE name = 'Rice & Sides'), 'Jeera Aloo', 'Potatoes tossed with cumin, chilli and coriander.', 5.95, 1, 1, 4),
((SELECT id FROM menu_categories WHERE name = 'Rice & Sides'), 'Bhindi Fry', 'Okra stir-fried with onion, tomato and dry spices.', 7.95, 1, 1, 5),
((SELECT id FROM menu_categories WHERE name = 'Rice & Sides'), 'Plain Raita', 'Chilled seasoned yoghurt served as a cooling accompaniment.', 3.95, 1, 1, 6),
((SELECT id FROM menu_categories WHERE name = 'Rice & Sides'), 'Boondi Raita', 'Seasoned yoghurt mixed with crisp gram-flour pearls.', 4.50, 1, 1, 7),
((SELECT id FROM menu_categories WHERE name = 'Rice & Sides'), 'Beetroot Raita', 'Chilled yoghurt with beetroot and gentle seasoning.', 4.95, 1, 1, 8),
((SELECT id FROM menu_categories WHERE name = 'Rice & Sides'), 'Green Salad', 'Lettuce, cucumber, tomato, onion and lemon.', 3.95, 1, 1, 9);

-- ── Desserts (6 items) ───────────────────────────────────────
INSERT INTO menu_items (category_id, name, description, price, is_veg, active, display_order) VALUES
((SELECT id FROM menu_categories WHERE name = 'Desserts'), 'Double Ka Meetha', 'Hyderabadi bread pudding flavoured with saffron, cardamom and nuts.', 4.95, 1, 1, 1),
((SELECT id FROM menu_categories WHERE name = 'Desserts'), 'Gulab Jamun with Ice Cream', 'Warm milk dumplings soaked in fragrant cardamom syrup, served with vanilla ice cream.', 5.95, 1, 1, 2),
((SELECT id FROM menu_categories WHERE name = 'Desserts'), 'Kulfi', 'Traditional Indian ice cream: malai, mango or pistachio.', 5.95, 1, 1, 3),
((SELECT id FROM menu_categories WHERE name = 'Desserts'), 'Apricot Delight', 'Stewed apricots layered with cream, nuts and a delicate hint of cardamom.', 6.50, 1, 1, 4),
((SELECT id FROM menu_categories WHERE name = 'Desserts'), 'Chocolate Brownie with Ice Cream', 'Warm chocolate brownie served with vanilla ice cream.', 6.95, 1, 1, 5),
((SELECT id FROM menu_categories WHERE name = 'Desserts'), 'Ice Cream Selection', 'Choose from vanilla, chocolate, strawberry or mango.', 4.95, 1, 1, 6);

-- =============================================================
-- Summary:
--   16 categories inserted
--   110 menu items inserted
--     Soups            : 4
--     Appetisers       : 7
--     Veg Starters     : 7
--     Royal Veg        : 7
--     Veg Mains        : 9
--     Veg Combos       : 2
--     Non-Veg Starters : 7
--     Royal Non-Veg    : 17
--     Non-Veg Mains    : 8
--     Non-Veg Combos   : 2
--     Biryanis         : 7
--     Royal Combos     : 5
--     Rice & Noodles   : 4
--     Breads           : 9
--     Rice & Sides     : 9
--     Desserts         : 6
-- =============================================================
