import { expect, test } from "@playwright/test";

// A seeded, approved catalogue item used by the existing public product smoke
// checks. This test is deliberately read-only: it never signs in or mutates a
// cart/order.
const PRODUCT_PATH = "/product/16a98878-7bf5-4299-a8ef-d7e984170ea6";

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`product detail remains usable at ${viewport.name} width`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    const response = await page.goto(PRODUCT_PATH, { waitUntil: "domcontentloaded" });
    expect(response?.status(), "product route should return a document").toBeLessThan(400);
    await expect(page.locator("main:visible")).toHaveCount(1, { timeout: 45_000 });
    await expect(page.locator("h1")).toHaveCount(1, { timeout: 45_000 });
    const heroImage = page.locator(`img[alt="${"Apple iPhone 17 Unlocked"}"]`).first();
    await expect(heroImage).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => heroImage.evaluate((image) => (image as HTMLImageElement).naturalWidth), { timeout: 20_000 }).toBeGreaterThan(0);
    await expect(page.getByRole("navigation", { name: "Product information" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Share product" })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow, "product page must not overflow horizontally").toBe(false);
    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
    await page.screenshot({ path: test.info().outputPath(`${viewport.name}-product-detail.png`), fullPage: false });
  });
}
