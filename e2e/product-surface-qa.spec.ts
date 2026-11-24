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

test("watches department stays scoped and does not reuse another catalogue", async ({ page }) => {
  test.setTimeout(60_000);
  const response = await page.goto("/categories/watches", { waitUntil: "domcontentloaded" });
  expect(response?.status(), "watches category route should return a document").toBeLessThan(400);
  await expect(page.locator("main:visible")).toHaveCount(1, { timeout: 45_000 });
  await expect(page.getByRole("heading", { name: "Watches", exact: true })).toBeVisible({ timeout: 30_000 });

  // The live catalogue may legitimately gain a watch after this test is written.
  // Assert the stable contract instead of hard-coding an empty department: either
  // the honest empty state is shown, or every visible result remains in Watches.
  const catalogueState = page.getByText(/No products listed yet|Showing \d+ product(?:s)?/).first();
  await expect(catalogueState).toBeVisible({ timeout: 30_000 });
  const emptyState = page.getByText("No products listed yet", { exact: true });
  if (await emptyState.isVisible()) {
    await expect(page.getByRole("list", { name: "Product results" })).toHaveCount(0);
  } else {
    const results = page.getByRole("list", { name: "Product results" });
    await expect(results).toBeVisible();
    await expect(results.getByText(/Apple iPhone|MacBook/i)).toHaveCount(0);
    expect(await results.locator('a[href^="/product/"]').count()).toBeGreaterThan(0);
  }
  await expect(page.getByText("Apple iPhone 17 Unlocked", { exact: true })).toHaveCount(0);
  await expect(page.getByText("MacBook", { exact: false })).toHaveCount(0);
});

test("missing product has a recoverable public error state", async ({ page }) => {
  test.setTimeout(60_000);
  const response = await page.goto("/product/not-a-real-product", { waitUntil: "domcontentloaded" });
  expect(response?.status(), "SPA should still return the public document").toBeLessThan(400);
  await expect(page.locator("main:visible")).toHaveCount(1, { timeout: 45_000 });
  await expect(page.getByRole("heading", { name: /Product not found|This product is temporarily unavailable/, exact: false })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: /Browse marketplace/i })).toHaveAttribute("href", "/marketplace");
});
