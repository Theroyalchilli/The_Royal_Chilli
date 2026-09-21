-- Hero banner text + rotating background images, moved from the hardcoded
-- lib/site-content.ts into app_settings so staff can edit them (Staff Hub >
-- Settings). Seeded to match the current text and desktop images exactly —
-- the separate mobile-crop set is dropped in favour of one shared image set
-- per slide, to keep the editor simple (one upload per slide, not two).
INSERT INTO app_settings (key, value) VALUES
  ('hero_content', '{
    "tag": "Authentic Flavours. Memorable Experiences.",
    "headline": "Authentic Indian Flavours.",
    "headlineGold": "Made to Be Remembered.",
    "description": "Discover authentic Hyderabadi, South Indian and North Indian cuisine, from signature dum biryanis and regional curries to dosas, grills and house specialities."
  }'::jsonb),
  ('hero_images', '[
    "/hero/desktop-food-spread.jpg",
    "/hero/desktop-interior.jpg",
    "/hero/desktop-bar.jpg",
    "/hero/desktop-table.jpg"
  ]'::jsonb)
ON CONFLICT (key) DO NOTHING;
