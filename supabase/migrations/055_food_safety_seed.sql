-- Starter check/temp/course config for the Food Safety module — standard
-- SFBB-style items so the Tasks screen has something real to log against.
-- These are defaults, not fixed: admin will be able to edit/add/retire them
-- via Config (not yet built) without touching this migration again.

INSERT INTO fs_check_type (check_window, label, rule_text, display_order) VALUES
  ('opening', 'Fridges and freezers ran at the right temperature overnight', 'Check the display or thermometer on each unit before use.', 1),
  ('opening', 'Hand-wash sinks stocked with soap and paper towels', NULL, 2),
  ('opening', 'Food prep areas clean and free of pests', 'Check under equipment and in corners, not just visible surfaces.', 3),
  ('opening', 'Everyone on shift is fit for work', 'No sickness/diarrhoea in the last 48 hours; cuts and sores covered with a blue plaster.', 4),
  ('service', 'Raw and ready-to-eat food kept separate', 'Separate boards, utensils and storage areas — no cross-contamination.', 1),
  ('service', 'Allergen information available and up to date', 'The dish allergen matrix reflects what''s actually on the menu today.', 2),
  ('closing', 'All food covered, labelled and dated before storage', NULL, 1),
  ('closing', 'Kitchen surfaces cleaned and sanitised', NULL, 2),
  ('closing', 'Bins emptied and outside area tidy', NULL, 3),
  ('weekly', 'Deep clean completed', 'Extraction, walk-in fridge, behind equipment.', 1),
  ('weekly', 'No signs of pest activity', 'Droppings, gnaw marks, nesting material.', 2)
ON CONFLICT DO NOTHING;

INSERT INTO fs_temp_type (label, kind, limit_value, rule_text, display_order) VALUES
  ('Fridge', 'max', 8.0, 'Must read 8°C or below.', 1),
  ('Freezer', 'max', -18.0, 'Must read -18°C or below.', 2),
  ('Hot-hold', 'min', 63.0, 'Must read 63°C or above.', 3),
  ('Cooking (core temperature)', 'min', 75.0, 'Must reach 75°C or above at the thickest part.', 4)
ON CONFLICT DO NOTHING;

INSERT INTO fs_course (name, refresh_months, has_level) VALUES
  ('Food Hygiene', 36, true),
  ('Allergen Awareness', 24, false),
  ('Health & Safety', 36, false)
ON CONFLICT DO NOTHING;
