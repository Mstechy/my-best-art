import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const publicRoutes = ["/", "/marketplace", "/categories", "/auth/login"] as const;

function describeViolations(violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]) {
  return violations
    .map((violation) => {
      const targets = violation.nodes.map((node) => node.target.join(", ")).join(" | ");
      return `${violation.id} (${violation.impact ?? "unknown"}): ${violation.help} [${targets}]`;
    })
    .join("\n");
}

for (const route of publicRoutes) {
  test(`${route} loads and has no automated accessibility violations`, async ({ page }) => {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${route} should return a document`).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveCount(1);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map((violation) => violation.id), describeViolations(results.violations)).toEqual([]);
  });
}
