-- Follow-up fixes discovered while verifying 026_dinner_menu_relaunch_v3.sql
-- against the spreadsheet's per-category counts:
--
-- 1. Crispy Corn Nibblets (id 146) was sitting in category 26 (Non-Vegetarian
--    Starters) instead of 32 (Vegetarian Starters) — a pre-existing
--    miscategorization, not something 026 introduced, but it threw off both
--    categories' counts (Non-Veg Starters read 16 instead of 15, Vegetarian
--    Starters read 10 instead of 11).
--
-- 2. 026's un-merges set the now-superseded items inactive (232, 254, 255,
--    256, 259) but never dropped their modifier_groups rows, leaving 5
--    orphaned groups (Choice, Style x2, Paneer Style, Flavour) with no
--    active item referencing them. Deleting the groups cascades to their
--    modifier_options and menu_item_modifier_groups rows automatically
--    (both ON DELETE CASCADE to modifier_groups).

BEGIN;

UPDATE menu_items SET category_id = 32 WHERE id = 146; -- Crispy Corn Nibblets: Non-Veg Starters -> Vegetarian Starters

DELETE FROM modifier_groups WHERE id IN (3, 4, 6, 7, 12); -- Choice, Style, Paneer Style, Style, Flavour (all orphaned by the un-merge)

COMMIT;
