import { test, expect } from "@playwright/test";

// P0 critical path (checklist §9, Employee/Manager Flow — POS order taking):
// staff logs into the till, opens a dine-in table, adds an item, and sends it
// to the kitchen. Same shared-database caveat as customer-order.spec.ts — this
// creates a real dine-in order every run, and needs a role allowed on the till
// (manager/employee, not just back-office-only roles). Requires the same
// E2E_STAFF_USERNAME/E2E_STAFF_PASSWORD as staff-login.spec.ts.
//
// NOTE: not run end-to-end during development of this spec (no test
// credentials were available) — table numbers/free-table labelling may need
// a small selector adjustment on first real run against your data.
const username = process.env.E2E_STAFF_USERNAME;
const password = process.env.E2E_STAFF_PASSWORD;

test.skip(!username || !password, "E2E_STAFF_USERNAME/E2E_STAFF_PASSWORD not set — skipping POS order E2E (see e2e/pos-order.spec.ts)");

test("staff can log in, open a free dine-in table, add an item and send it to the kitchen", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/(pos|staff)/, { timeout: 10_000 });
  if (!page.url().includes("/pos")) await page.goto("/pos");

  // Dine-In is the default order type; pick the first free table.
  const freeTable = page.getByText("FREE").first().locator("..");
  await freeTable.click();

  const firstMenuItem = page.locator("button", { hasText: "£" }).first();
  await firstMenuItem.click();

  await expect(page.getByText(/Send to Kitchen/i)).toBeVisible();
  await page.getByText(/Send to Kitchen/i).click();

  // A successful send clears the "Processing…" state without an error toast.
  await expect(page.getByText("Processing…")).toHaveCount(0, { timeout: 10_000 });
});
