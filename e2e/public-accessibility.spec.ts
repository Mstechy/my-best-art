import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const publicRoutes = ["/", "/marketplace", "/categories", "/auth/login"] as const;

function describeViolations(violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]) {
  return violations
    .map((violation) => {
      const targets = violation.nodes
        .map((node) => `${node.target.join(", ")} ${node.html}`)
        .join(" | ");
      return `${violation.id} (${violation.impact ?? "unknown"}): ${violation.help} [${targets}]`;
    })
    .join("\n");
}

for (const route of publicRoutes) {
  test(`${route} loads and has no automated accessibility violations`, async ({ page }) => {
    test.setTimeout(60_000);
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${route} should return a document`).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
    // Public routes are lazy-loaded. On a cold local Vite server, the first
    // route can take longer than Playwright's five-second assertion default
    // while the browser compiles the route chunk. Wait for the actual landmark
    // instead of treating the Suspense shell as a failed page.
    await expect(page.locator("main:visible")).toHaveCount(1, { timeout: 20_000 });
    await expect(page.locator("h1:visible")).toHaveCount(1, { timeout: 20_000 });
    // Consent is intentionally delayed to avoid competing with first paint;
    // wait for it before scanning so the same persistent UI is covered on
    // every route instead of making the result timing-dependent.
    const cookieConsent = page.getByTestId("cookie-consent");
    await expect(cookieConsent).toBeVisible({ timeout: 5_000 });
    // Axe evaluates contrast using the current composited opacity. Wait for
    // the consent card's entrance animation to finish so a mid-fade scan does
    // not report a false contrast failure.
    await expect(cookieConsent).toHaveCSS("opacity", "1", { timeout: 5_000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map((violation) => violation.id), describeViolations(results.violations)).toEqual([]);
  });
}

test("category department routes resolve to a marketplace listing", async ({ page }) => {
  test.setTimeout(60_000);
  const directoryResponse = await page.goto("/categories", { waitUntil: "domcontentloaded" });
  expect(directoryResponse?.status(), "/categories should return a document").toBeLessThan(400);
  await expect(page.locator("main:visible")).toHaveCount(1, { timeout: 20_000 });

  // The directory is data-backed and may legitimately render its empty/loading
  // state while a parallel browser worker is warming Supabase. Use the seeded
  // department for this routing smoke check; the public storefront suite separately
  // verifies that a live directory link is produced and navigates through it.
  const departmentHref = "/categories/electronics";

  const listingResponse = await page.goto(departmentHref!, { waitUntil: "domcontentloaded" });
  expect(listingResponse?.status(), `${departmentHref} should return a document`).toBeLessThan(400);
  await expect(page.locator("main:visible")).toHaveCount(1, { timeout: 20_000 });
  await expect(page.locator("h1:visible")).toHaveCount(1, { timeout: 20_000 });
});
