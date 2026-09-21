-- Staff-curated "Most Popular Dishes" for the homepage — ties to real
-- menu_items (name/price) instead of the old standalone branded poster
-- images, so there's no duplicate data entry and the dish info can't drift
-- from what's actually on the menu. Starts empty deliberately: the old
-- poster images don't map cleanly onto real dishes (one of the six was a
-- general brand graphic, not a dish), so seeding this from them would mean
-- guessing at photo-to-dish matches rather than reflecting reality. The
-- homepage falls back to the old hardcoded poster grid until staff add at
-- least one real featured dish here.
CREATE TABLE IF NOT EXISTS featured_dishes (
  id           SERIAL PRIMARY KEY,
  menu_item_id INT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  image_url    TEXT NOT NULL,
  blurb        TEXT,
  position     INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_featured_dishes_position ON featured_dishes(position);
