-- "Our Story" content — the /about page's full story paragraphs plus the
-- shorter homepage excerpt — moved from the hardcoded lib/site-content.ts
-- into app_settings so staff can edit the copy themselves. Seeded to match
-- the current text exactly, so nothing visibly changes until edited.
INSERT INTO app_settings (key, value) VALUES
  ('about_excerpt', '{
    "title": "Where Every Dish Tells a Story of",
    "titleGold": "Passion & Heritage",
    "text1": "The Royal Chilli is a contemporary Indian restaurant bringing together the bold flavours of Hyderabad, the traditions of South India and the richness of classic North Indian cuisine.",
    "text2": "From fragrant dum biryanis and regional curries to dosas, tandoori grills, breakfast favourites and modern house specials, our menu is built around authentic recipes, quality ingredients and generous hospitality."
  }'::jsonb),
  ('our_story_paragraphs', '[
    "The Royal Chilli is a contemporary Indian restaurant bringing together the bold flavours of Hyderabad, the traditions of South India and the richness of classic North Indian cuisine.",
    "From fragrant dum biryanis and regional curries to dosas, tandoori grills, breakfast favourites and modern house specials, our menu is built around authentic recipes, quality ingredients and generous hospitality.",
    "We serve our customers throughout the day with breakfast, lunch, dine-in, takeaway, delivery, catering, private events and bar service, creating a restaurant experience that is accessible, enjoyable and consistently memorable."
  ]'::jsonb)
ON CONFLICT (key) DO NOTHING;
