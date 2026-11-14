import { expect, test } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

for (const viewport of viewports) {
  test(`public shopping journey is stable on ${viewport.name}`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    const homeResponse = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(homeResponse?.status(), "homepage should return a document").toBeLessThan(400);
    await expect(page.locator("main:visible")).toHaveCount(1, { timeout: 30_000 });
    await expect(page.getByRole("region", { name: "Featured collections" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("link", { name: "Shop collection" })).toBeVisible();

    const scrollState = await page.evaluate(() => ({
      scrollY: window.scrollY,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    }));
    expect(scrollState.scrollY, "a fresh storefront visit should open at the hero").toBe(0);
    expect(scrollState.overflow, "public storefront must not overflow horizontally").toBe(false);

    const departmentLink = page.locator('main:visible a[href^="/categories/"]').first();
    await expect(departmentLink).toBeVisible({ timeout: 30_000 });
    const departmentHref = await departmentLink.getAttribute("href");
    expect(departmentHref).toMatch(/^\/categories\/[^/]+$/);

    const departmentResponse = await page.goto(departmentHref!, { waitUntil: "domcontentloaded" });
    expect(departmentResponse?.status(), "department should return a document").toBeLessThan(400);
    await expect(page.locator("main:visible")).toHaveCount(1, { timeout: 30_000 });
    await expect(page.locator("main:visible h1")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /Filters/i })).toBeVisible();

    const productLink = page.locator('main:visible a[href^="/product/"]').first();
    await expect(productLink).toBeVisible({ timeout: 30_000 });
    const productHref = await productLink.getAttribute("href");
    expect(productHref).toMatch(/^\/product\/[^/]+$/);

    const productResponse = await page.goto(productHref!, { waitUntil: "domcontentloaded" });
    expect(productResponse?.status(), "product detail should return a document").toBeLessThan(400);
    await expect(page.locator("main:visible h1")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Share product" })).toBeVisible({ timeout: 30_000 });

    const footer = page.locator("footer");
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeVisible();
    expect(await footer.locator('a[href="/shipping"]').count()).toBeGreaterThan(0);
    expect(await footer.locator('a[href="/payment"]').count()).toBeGreaterThan(0);
    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);

    await page.screenshot({ path: test.info().outputPath(`${viewport.name}-public-storefront.png`), fullPage: false });
  });
}

test("unknown department does not fall through to the full catalogue", async ({ page }) => {
  test.setTimeout(60_000);
  const response = await page.goto("/categories/not-a-real-department", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBeLessThan(400);
  await expect(page.getByRole("heading", { name: "Department not found" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: "Browse departments" })).toHaveAttribute("href", "/categories");
  expect(await page.locator('main:visible a[href^="/product/"]').count()).toBe(0);
});
