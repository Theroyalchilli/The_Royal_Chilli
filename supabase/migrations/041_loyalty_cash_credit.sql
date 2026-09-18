-- Direct points-to-money redemption at the till — separate from the reward
-- catalogue (which stays for specific named rewards like a birthday
-- freebie). This is the everyday "use my points" button on the payment
-- screen: points convert to £ at a configurable rate, usable in fixed
-- £-cap chunks per transaction once the balance is worth at least that
-- much — no code, no trip to Staff Hub.
INSERT INTO app_settings (key, value) VALUES
  ('loyalty_conversion_points_per_pound', '100'),
  ('loyalty_max_redeem_per_visit', '5')
ON CONFLICT (key) DO NOTHING;
