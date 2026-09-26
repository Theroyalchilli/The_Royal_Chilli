# Printing (Star mC-Print3 via CloudPRNT)

One printer — a Star mC-Print3 — prints everything:

| What | When it prints |
|---|---|
| Kitchen ticket, **TILL** | the moment staff press **Send to Kitchen** |
| Kitchen ticket, **QR ORDER** | the moment a customer sends a round from the table QR page (a later round prints only its new items, marked `+ ADDITIONAL ITEMS +`) |
| Kitchen ticket, **ONLINE** | pay on collection/delivery: as soon as it's placed. Pay online: once Stripe confirms payment. Scheduled for later: ~30 min before the slot (45 for delivery) |
| Customer receipt | when staff press **Print Receipt** (after payment) or **Reprint Receipt** (Order History) |
| Kitchen ticket, **REPRINT** | when staff press **Print KOT** on the Kitchen Display |

The printer itself polls the POS over the internet every few seconds
(Star's CloudPRNT protocol) — no PC, browser tab, driver or
`--kiosk-printing` shortcut is needed, and nothing prints twice. The Kitchen
Display is screen-only; it no longer auto-prints.

## How it works

- Every ticket is a row in the `print_jobs` table (`lib/print-queue.ts`).
- The printer calls `/api/cloudprnt` (`app/api/cloudprnt/route.ts`):
  POST = "any job?", GET = fetch it, DELETE = "printed, mark it done".
- Tickets are rendered at fetch time (`lib/cloudprnt.ts`) as StarPRNT
  commands (bold, double-size, auto-cut), with plain text as a fallback.
- A job whose order was cancelled before it printed is skipped. A job still
  unprinted after 6 hours (printer off all day) is left unprinted rather than
  dumping stale orders into a live kitchen.
- If the printer reports an error (e.g. out of paper) the job stays queued
  and prints once the problem is fixed.

## One-time setup

### 1. Secret key (Vercel)
The endpoint is on the public internet and tickets carry customer names,
phones and addresses, so it requires a key. In the Vercel dashboard →
project → Settings → Environment Variables, add `CLOUDPRNT_KEY` (Production)
set to a long random string, then redeploy. Without it, production refuses
every printer request.

### 2. Network cable
Plug a network cable from the printer's **LAN** port into the router or a
network switch. (The USB cable can stay in — it isn't used for this.)

### 3. Find the printer's IP address
Switch the printer off, hold **FEED**, switch it on, release when it starts
printing. The self-test page shows its IP address (e.g. `192.168.1.50`).
Reserve that IP for the printer in the router, so it doesn't change.

### 4. Turn on CloudPRNT in the printer
On any computer on the same network, open `http://<printer IP>` in a
browser and log in (default user `root`, password `public` — change it).
In the **CloudPRNT** settings:

- Enable CloudPRNT
- Server URL: `https://<POS domain>/api/cloudprnt?key=<CLOUDPRNT_KEY>`
- Polling interval: 3–5 seconds

Save, and restart the printer when asked.

### 5. Test
Send a test order to the kitchen from the till — it should print within a
few seconds. Then Print Receipt on a paid order.

If nothing prints, check the Vercel runtime logs for `[cloudprnt]` lines —
every job fetch and confirmation is logged with the printer's own request
parameters (key removed).
