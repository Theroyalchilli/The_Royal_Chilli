-- One customer, one record (part A).
--
-- 1. Mobiles in one format — 07XXXXXXXXX — so "07700 900123",
--    "07700900123" and "+44 7700 900123" are the same person. Numbers that
--    would clash with another record after cleaning are left as they are
--    (those are duplicates for the merge screen, part B).
-- 2. A merged record points at the record it was merged into and is hidden
--    everywhere (lib/customer-merge.ts).

ALTER TABLE customers ADD COLUMN IF NOT EXISTS merged_into INT REFERENCES customers(id);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS merged_at   TIMESTAMPTZ;

WITH cleaned AS (
  SELECT id,
         CASE
           WHEN d ~ '^447\d{9}$' THEN '0' || substr(d, 3)
           WHEN d ~ '^7\d{9}$'   THEN '0' || d
           ELSE d
         END AS phone_new
  FROM (SELECT id, regexp_replace(phone, '[^0-9]', '', 'g') AS d FROM customers WHERE phone IS NOT NULL) x
),
safe AS (
  SELECT c.id, c.phone_new
  FROM cleaned c
  JOIN customers cu ON cu.id = c.id
  WHERE c.phone_new ~ '^07\d{9}$'
    AND c.phone_new <> cu.phone
    -- only if no other record already has (or would get) this number
    AND NOT EXISTS (SELECT 1 FROM customers o WHERE o.id <> c.id AND o.phone = c.phone_new)
    AND (SELECT count(*) FROM cleaned c2 WHERE c2.phone_new = c.phone_new) = 1
)
UPDATE customers cu SET phone = safe.phone_new FROM safe WHERE cu.id = safe.id;
