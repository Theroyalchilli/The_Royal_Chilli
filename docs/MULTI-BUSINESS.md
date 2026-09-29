# Multi-business — status, checklist and what's left

One system for several businesses: **The Royal Chilli (1)**, **Melt House (2)**,
**ABCD (3)**, **EFGH (4)**. One database, the same two Vercel projects
(`royal-chilli-pos`, `royal-chilli-attendance`), every business-owned row tagged
with `business_id`. Decided 2026-09-29.

- Mixed business types → per-business module switches (`businesses.modules`).
- Shared across the group: staff (can work at several), customers + rewards
  scheme, suppliers.
- Each business is a separate company: own VAT number, Stripe/SumUp, accounts,
  payroll (per employer).

## Where it's up to

| Phase | What | Status |
|---|---|---|
| 1 | Foundation: `businesses`, `staff_businesses`, `business_id` on 36 tables, triggers (migrations 076, 077) | **Done** |
| 2 | Every screen / API per business (menu, orders, tables, payments, Finance, Inventory, HR, attendance, rewards, website) | **Done** — attendance app waiting on migration 078 |
| 3 | Per-business settings + branding | Not started |
| 4 | Group admin: business switcher, group dashboard, businesses admin screen | Not started |
| 5 | Shared staff / customers / suppliers across businesses | Not started |
| 6 | Websites + domains per business | Not started |
| 7 | Launch Melt House, then ABCD, EFGH | Not started |

## Waiting on you

1. **Run migration 078** in the Supabase SQL editor:
   `supabase/migrations/078_business_messages_corrections_timesheets.sql`
   (safe with either version of the attendance app live).
2. Tell Claude — then:
   - push `royal-chilli-attendance` commit `395ce85` (attendance app per business), and
   - add `"staff_messages", "attendance_corrections"` to `BUSINESS_TABLES` in
     `lib/business-db.ts` here, and push.

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

## Phase 3 — per-business settings + branding (next)

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

## Phase 4 — group admin

- Business switcher in the Staff Hub header (group admin only); managers
  locked to their business(es) via `staff_businesses`.
- Group dashboard: each business side by side + combined (sales, profit,
  staff cost %, platforms).
- Businesses admin screen: add a business, module switches, logo, payments,
  printers.
- Menus/screens hide switched-off modules.

## Phase 5 — shared staff, customers, suppliers

- Add an existing staff member to another business (role per business;
  `staff.role` is still the source of truth today — `staff_businesses.role` is
  kept in step on change).
- Usual rota pattern per business (today it's on the shared `staff` row).
- Pay rate per employer (today `staff.pay_rate`).
- Drop the old timesheets unique (`staff_id, period_start, period_end`) once
  someone works at two businesses (078 left it in place).
- Rewards settlement report: points earned at one business, spent at another
  (`loyalty_transactions.business_id`, `loyalty_redemptions.redeemed_order_id`).
- Privacy policy + sign-up wording: the companies share customer details
  (UK GDPR — check with a solicitor).

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
