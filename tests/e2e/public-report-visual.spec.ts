import { expect, test } from "@playwright/test";

import { inspectVisibleUi } from "./support/ui-visual-audit";

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 1000 },
] as const;

for (const viewport of viewports) {
  test(`public report remains readable at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/r/traceable-citations-review-zh");

    await expect(page.getByTestId("public-report")).toBeVisible();
    const metrics = await page.evaluate(() => {
      const report = document.querySelector<HTMLElement>('[data-testid="public-report"]');
      const sections = Array.from(
        document.querySelectorAll<HTMLElement>('[data-public-report-section="true"]'),
      );
      const citations = document.querySelector<HTMLElement>('[data-public-citations="true"]');

      return {
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        reportWidth: report?.getBoundingClientRect().width ?? 0,
        sectionsDoNotOverlap: sections.every((section, index) => {
          const next = sections[index + 1];
          return !next || section.getBoundingClientRect().bottom <= next.getBoundingClientRect().top;
        }),
        citationsFollowSections:
          sections.length > 0 && citations
            ? sections.at(-1)!.getBoundingClientRect().bottom <=
              citations.getBoundingClientRect().top
            : false,
      };
    });
    const audit = await inspectVisibleUi(page, [
      "[data-public-report-section='true']",
      "[data-public-citations='true'] blockquote",
    ]);
    const reading = await page.evaluate(() => {
      const paragraph = document.querySelector<HTMLElement>("[data-public-report-section] p");
      if (!paragraph) {
        throw new Error("public report paragraph is missing");
      }

      return {
        paragraphSize: Number.parseFloat(getComputedStyle(paragraph).fontSize),
        paragraphWidth: paragraph.getBoundingClientRect().width,
      };
    });

    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.reportWidth).toBeGreaterThan(viewport.name === "mobile" ? 340 : 700);
    expect(metrics.sectionsDoNotOverlap).toBe(true);
    expect(metrics.citationsFollowSections).toBe(true);
    expect(audit.fontSizeViolations).toEqual([]);
    expect(audit.leftRuleViolations).toEqual([]);
    expect(reading.paragraphSize).toBeGreaterThanOrEqual(16);
    expect(reading.paragraphWidth).toBeLessThanOrEqual(760);

    await page.screenshot({
      path: `output/playwright/public-report-${viewport.name}.png`,
      fullPage: true,
    });
  });
}

test("print mode hides sharing tools and preserves the report body", async ({ page }) => {
  await page.goto("/r/traceable-citations-review-zh");
  await page.emulateMedia({ media: "print" });

  await expect(page.getByTestId("public-report-tools")).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "精确引用降低核查成本" }),
  ).toBeVisible();
  await expect(page.getByRole("list", { name: "引用来源" })).toBeVisible();
});
