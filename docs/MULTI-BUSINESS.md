# Multi-business — status, checklist and what's left

One system for several businesses: **The Royal Chilli (1)**, **Melt House (2)**,
**ABCD (3)**, **EFGH (4)**. One database, the same two Vercel projects
(`royal-chilli-pos`, `royal-chilli-attendance`), every business-owned row tagged
with `business_id`. Decided 2026-09-29.

- Mixed business types → per-business module switches (`businesses.modules`).
- **Every business is fully independent (decided 29 Sep 2026, replacing the
  earlier "shared staff / customers / suppliers"):** each creates its own staff,
  suppliers and customers (with their own rewards scheme). Someone working at
  two businesses has a staff record at each; a customer of two has two accounts.
- **Group admin = the owner only:** one dashboard across all businesses, and a
  switcher to work inside any of them. A business's own "admin" sees only it.
- Usernames are unique across the whole group (one login page).
- **One shared core + a folder per business:** `businesses/<slug>/` holds that
  business's logo, colours, website pages, wording and any feature only it
  needs — editing it changes only that business. (A full separate copy per
  business was considered and rejected: every fix 4×, four databases, no
  single admin view.)
- Each business is a separate company: own VAT number, Stripe/SumUp, accounts,
  payroll.

## Where it's up to

| Phase | What | Status |
|---|---|---|
| 1 | Foundation: `businesses`, `staff_businesses`, `business_id` on 36 tables, triggers (migrations 076, 077) | **Done** |
| 2 | Every screen / API per business (menu, orders, tables, payments, Finance, Inventory, HR, attendance, rewards, website) | **Done** (both apps live) |
| 2b | **Next:** fully separate staff, suppliers, customers + rewards (migration 079) and the owner's group admin (switcher, combined dashboard) | Not started |
| 3 | Per-business settings + branding, `businesses/<slug>/` folders | Not started |
| 4 | Businesses admin screen (add a business, module switches, payments, printers) | Not started |
| 5 | ~~Shared staff / customers / suppliers~~ — replaced by 2b (everything separate) | Dropped |
| 6 | Websites + domains per business | Not started |
| 7 | Launch Melt House, then ABCD, EFGH | Not started |

## Migrations

Run in order in the Supabase SQL editor
(https://supabase.com/dashboard/project/xmsgkshtgtdkdbmkhmep/sql/new), from
`supabase/migrations/`:

| Migration | Status |
|---|---|
| 076 foundation | run 29 Sep 2026 |
| 077 rows never change business | run 29 Sep 2026 |
| 078 messages, corrections, timesheets, points | run 29 Sep 2026 — attendance app pushed after it |
| 079 fully separate staff / suppliers / customers | to be written (Phase 2b) |

## Checklist (all on The Royal Chilli — everything should look exactly as before)

**Till & kitchen**
1. Sign in on a till with a **PIN**; sign in to the Staff Hub with a **password**.
2. Till order → send to kitchen → shows on the Kitchen Display, prints, number starts `RC-`.
3. Mark a dish **sold out** and back on.
4. Take a **card** and a **cash** payment; a small **refund** with a manager PIN; **Pay Later** on a test order.
5. **End of Day** → X report figures look right (don't close unless you mean to).

**Tables, QR & website**
6. Scan a table **QR** → send a round → **call waiter** shows on the till.
7. Website: **Order Online** menu, a test order (new-order chime), a test **booking**.
8. **Promotion banner** still shows.

**Staff Hub**
9. **Dashboard** loads with the same figures as before.
10. **Finance → Profit & Loss / VAT / Z Reports / Accountant export** load.
11. **Menu**: edit a dish price and put it back.
12. **Inventory**: ingredients, purchase orders, recipes load.
13. **HR & Payroll**: employee list, one employee's HR record, a payroll period.
14. **Customers & Loyalty**: redeem a voucher code on a test order.

**Attendance app** (after 078 + the push)
15. Clock in / out on your phone.
16. Manager: rota, attendance, timesheets, approvals load.

## Phase 3 — per-business settings + branding

- `app_settings` is global today → per-business settings (keep Royal Chilli's
  current values as business 1): VAT rate stays group-wide.
- Payments per company: Stripe account + webhook per business; SumUp / Stripe
  Terminal card reader per business (`lib/till-reader.ts`, `app/api/pos/terminal/*`).
- Opening hours, busy mode, reservation deposit, delivery radius + restaurant
  location (`/api/public/delivery-zones/check`), attendance geofence + timezone.
- Branding: name, logo, colours, receipt header/footer, emails (Brevo sender,
  templates in `lib/email.ts`), site wording (`lib/site-content.ts`, ~47 files
  say "Royal Chilli"), `siteUrl()` per domain, Stripe line items.
- Printer: CloudPRNT key per business (today one `CLOUDPRNT_KEY`; the printer
  URL already takes `?b=<business id>`).

## Phase 2b — fully separate businesses + group admin (next)

- Migration 079: `business_id` on staff, suppliers, customers (+ addresses),
  loyalty tiers, rewards, redemptions, newsletter subscribers; existing rows →
  Royal Chilli. Customer phone / email unique **per business**; usernames stay
  unique across the group; voucher and referral codes stay unique across the group.
- HR records, documents, PINs, rota and pay follow their staff member's business.
- Code: staff, HR, PIN, supplier, customer, account (website login) and rewards
  routes go through `bizDb`; the `staff_businesses` links and "works here"
  checks are replaced by the staff row's own business.
- Group admin: an owner-only flag on a **new separate owner login** (e.g.
  username `owner`); the existing "Royalchilli" admin stays Royal Chilli's own
  admin. Business switcher in the Staff Hub header ("Working in: … ▾", act
  fully inside any business, every action logged under the owner's name);
  group dashboard (each business side by side + combined total).
- A new business's rewards scheme starts as a **copy of Royal Chilli's**
  (tiers, rewards, points rules), then that business edits it.
- Safety rules: a purchase order can't use another business's supplier; an
  order / booking can't link another business's customer.
- Go-live order: you run 078 → attendance app pushed → 079 + new code together.
- Attendance app follows the same rules.
- Drop the old timesheets unique key (078 kept it) once staff are per business.

## Phase 3 (also) — business folders

- `businesses/<slug>/`: logo, colours, website pages and wording, receipt
  header/footer, email templates, and any feature only that business uses.

## Phase 4 — businesses admin screen

- Add a business, module switches, logo, payments, printers.
- Menus and screens hide switched-off modules.

## Phase 6 — domains

- Point each business's domain at `royal-chilli-pos`; set `businesses.domain`.
- Until then a business can use `?b=<slug>` on shared links (QR codes).
- Melt House's current site is on Framer — decide: keep it, or move onto this system.

## Phase 7 — launch

- Melt House first (dessert café: till, stock, rewards, food safety on;
  tables / kitchen display / QR / online ordering / delivery / bookings off).
- Then ABCD, EFGH (real names, domains, logos, company + VAT numbers,
  Stripe/SumUp accounts needed).

## Other notes

- `scripts/backup.js` only backs up 38 of the 72 tables — update it (a full
  REST backup was taken to `backups/pre-multi-business-2026-09-29-09-39-25`).
- The till accepts the on-screen price for a dish (only checks the dish is this
  business's) — enforce menu prices only if wanted.
