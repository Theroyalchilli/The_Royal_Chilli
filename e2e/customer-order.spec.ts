import { test, expect } from "@playwright/test";

// P0 critical path (checklist §9, Customer Order Flow): browse → add item with
// a required modifier → checkout → place a pay-on-collection order → confirm.
//
// CAVEAT: this project has no separate staging database — this spec runs
// against the same Supabase instance as production and creates a real order
// row every time it runs. The customer name below is deliberately tagged so
// the row is easy to find and delete afterwards; there's no automated
// cleanup here (see docs/TESTING.md for how orders show up in the till).
test("customer can browse the menu, add an item with a modifier, and place a collection order", async ({ page }) => {
  await page.goto("/order");

  const firstItemAddButton = page.locator("button", { hasText: "+" }).first();
  await firstItemAddButton.click();

  // The modifier modal requires a Spice Level selection before it'll add.
  const modal = page.getByText("Spice Level").locator("..");
  await modal.getByText("Mild", { exact: true }).click();
  await page.getByRole("button", { name: /^ADD/i }).click();

  await expect(page.getByText("Your Order").locator("..")).toContainText("Total");
  await page.getByRole("button", { name: "CHECKOUT" }).click();

  await expect(page).toHaveURL(/\/order\/checkout/);
  await page.getByPlaceholder("Full name").fill("E2E Test Customer");
  await page.getByPlaceholder(/Mobile number/i).fill("07700900000");

  await page.getByRole("button", { name: /PLACE ORDER/i }).click();

  await expect(page.getByText("Order Confirmed!")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/is being prepared/)).toBeVisible();
});
