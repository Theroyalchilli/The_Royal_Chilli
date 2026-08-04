# Kitchen Auto-Print Setup

The Kitchen Display (`/pos/kitchen`) automatically prints a ticket for every
new order the moment it's sent from the till — no one needs to click
anything. This only works properly if the device showing that page is set up
for **silent printing**. Without it, every new order pops up the browser's
native print dialog and **freezes the page** until someone dismisses it —
verified directly while building this (a real print dialog blocked the whole
tab until manually closed).

## One-time setup on the kitchen device

1. Connect your chosen thermal receipt printer and set it as that device's
   **default printer** at the OS level (Windows/Android/etc — whatever the
   device runs).
2. Launch Chrome with the `--kiosk-printing` flag, which auto-confirms print
   jobs to the default printer with no dialog:

   **Windows** — create a shortcut with this target:
   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing --kiosk https://royal-chilli-pos.vercel.app/pos/kitchen
   ```
   (drop `--kiosk` if you want a normal window instead of full-screen)

   **Android tablet** — Chrome doesn't support this flag on Android. Use a
   kiosk-browser app that supports silent printing (e.g. "Fully Kiosk
   Browser") pointed at the same URL, or fall back to a small always-on PC
   instead.

3. Log in once on that device (Kitchen role is fine) and leave the tab open.
   New orders will print themselves from then on.

## How it works

- Every "Send to Kitchen" click creates a new order row — the Kitchen Display
  polls `/api/kitchen` every 10 seconds and auto-prints any order it hasn't
  printed yet (tracked in that device's `localStorage`, so a page refresh or
  crash-recovery won't cause duplicate reprints, and won't miss anything
  either — if the tab was closed when an order came in, it'll catch up and
  print it on the next load).
- The manual "🖨️ Print KOT" button on each order card still works, for
  reprinting or if you want to print from a different device too.
- This is separate, additive behavior — it doesn't change how orders reach
  the kitchen if you never set up a dedicated device; the Kitchen Display page
  still works normally for anyone viewing it on any browser.
