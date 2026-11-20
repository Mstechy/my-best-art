import { expect, test } from "@playwright/test";

// These are read-only checks against the seeded public catalogue. They protect
// the category-aware presentation without creating static catalogue fixtures.
const LAPTOP_PATH = "/product/eecfa1fb-f881-4b4d-a1ee-acc475df9214";

test("laptop detail exposes laptop facts without phone-only fields", async ({ page }) => {
  test.setTimeout(60_000);
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  const response = await page.goto(LAPTOP_PATH, { waitUntil: "domcontentloaded" });
  expect(response?.status(), "laptop product route should return a document").toBeLessThan(400);
  await expect(page.locator("main:visible")).toHaveCount(1, { timeout: 45_000 });
  await expect(page.locator("h1")).toHaveCount(1, { timeout: 45_000 });
  await expect(page.getByText("Processor", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("RAM", { exact: true })).toBeVisible();
  await expect(page.getByText("Mobile network support", { exact: true })).toHaveCount(0);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow, "laptop detail must not overflow horizontally").toBe(false);
  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
});

test("empty watches department stays honest and does not reuse another catalogue", async ({ page }) => {
  test.setTimeout(60_000);
  const response = await page.goto("/categories/watches", { waitUntil: "domcontentloaded" });
  expect(response?.status(), "watches category route should return a document").toBeLessThan(400);
  await expect(page.locator("main:visible")).toHaveCount(1, { timeout: 45_000 });
  await expect(page.getByRole("heading", { name: "Watches", exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("No products listed yet", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Apple iPhone 17 Unlocked", { exact: true })).toHaveCount(0);
  await expect(page.getByText("MacBook", { exact: false })).toHaveCount(0);
});
