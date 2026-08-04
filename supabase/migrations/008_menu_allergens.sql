-- Website leftover: allergens + basic nutrition info on menu items.
-- allergens uses the 14 UK/EU legally-recognised allergen categories.
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS allergens TEXT[] DEFAULT '{}';
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS calories INT;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS protein_g NUMERIC(6,1);
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS carbs_g NUMERIC(6,1);
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS fat_g NUMERIC(6,1);
