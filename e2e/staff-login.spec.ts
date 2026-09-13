import { test, expect } from "@playwright/test";

// P0 critical path (checklist §9, Employee/Manager Flow): staff login lands
// on the right area for their role. Requires real credentials, which this
// repo deliberately does NOT hardcode or create automatically (this project
// has one shared database, no staging environment — see customer-order.spec.ts).
// Set these in your own .env.local (never commit real ones) to run this spec:
//   E2E_STAFF_USERNAME, E2E_STAFF_PASSWORD, E2E_STAFF_ROLE ("employee" | "manager" | "hr" | "admin")
const username = process.env.E2E_STAFF_USERNAME;
const password = process.env.E2E_STAFF_PASSWORD;
const role = process.env.E2E_STAFF_ROLE || "manager";

test.skip(!username || !password, "E2E_STAFF_USERNAME/E2E_STAFF_PASSWORD not set — skipping staff login E2E (see e2e/staff-login.spec.ts)");

test("staff login lands on the right area for the account's role", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();

  if (role === "employee") {
    await expect(page).toHaveURL(/\/pos/, { timeout: 10_000 });
  } else {
    await expect(page).toHaveURL(/\/staff/, { timeout: 10_000 });
    await expect(page.getByText(/Good (morning|afternoon|evening)/)).toBeVisible();
  }
});

test("wrong password shows an error and does not log in", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username!);
  await page.getByLabel("Password").fill("definitely-the-wrong-password");
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page.getByRole("alert")).toContainText(/invalid/i);
  await expect(page).toHaveURL(/\/login/);
});
