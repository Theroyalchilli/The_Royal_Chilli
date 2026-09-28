-- Rewards Club, phase 3: visit bonuses. A "visit" is a trading day (5am–5am
-- UK) on which the member had a paid order; the bonus lands on the first
-- paid order of that day. 2nd visit +200, 3rd +300, every 5th (5th, 10th,
-- 15th…) +500. Editable in Staff Hub → Customers → Rewards rules.
INSERT INTO app_settings (key, value) VALUES
  ('loyalty_visit_bonus_fixed',        '{"2": 200, "3": 300}'),
  ('loyalty_visit_bonus_every_n',      '5'),
  ('loyalty_visit_bonus_every_points', '500')
ON CONFLICT (key) DO NOTHING;
