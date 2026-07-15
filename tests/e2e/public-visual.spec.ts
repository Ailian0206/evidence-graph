import { expect, test } from "@playwright/test";

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 1000 },
] as const;

for (const viewport of viewports) {
  test(`public portfolio keeps its visual contract at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/zh");

    await expect(page.getByRole("heading", { name: "Ailian", exact: true })).toBeVisible();
    await expect(
      page
        .getByRole("navigation")
        .getByRole("link", { name: "Evidence Graph", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".evidence-canvas-hero .canvas-inspector")).toBeVisible();

    const metrics = await page.evaluate(() => {
      const header = document.querySelector<HTMLElement>(".site-header");
      const hero = document.querySelector<HTMLElement>(".portfolio-hero");
      const selectedWork = document.querySelector<HTMLElement>("#selected-work");
      const graphNode = document.querySelector<HTMLElement>(".graph-node");
      const canvas = document.querySelector<HTMLElement>(".evidence-canvas");
      const heroNodes = Array.from(
        document.querySelectorAll<HTMLElement>(".evidence-canvas-hero .graph-node"),
      );

      if (!header || !hero || !selectedWork || !graphNode || !canvas) {
        throw new Error("visual contract elements are missing");
      }

      return {
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        headerHeight: header.getBoundingClientRect().height,
        heroHeight: hero.getBoundingClientRect().height,
        selectedWorkTop: selectedWork.getBoundingClientRect().top,
        graphNodePosition: getComputedStyle(graphNode).position,
        canvasBackground: getComputedStyle(canvas).backgroundColor,
        heroNodesInsideViewport: heroNodes.every((node) => {
          const bounds = node.getBoundingClientRect();
          return bounds.left >= 0 && bounds.right <= window.innerWidth;
        }),
      };
    });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.headerHeight).toBeGreaterThanOrEqual(56);
    expect(metrics.headerHeight).toBeLessThanOrEqual(80);
    expect(metrics.heroHeight).toBeGreaterThanOrEqual(metrics.viewportHeight - 100);
    expect(metrics.selectedWorkTop).toBeLessThanOrEqual(metrics.viewportHeight + 48);
    expect(metrics.graphNodePosition).toBe("absolute");
    expect(metrics.canvasBackground).not.toBe("rgba(0, 0, 0, 0)");
    expect(metrics.heroNodesInsideViewport).toBe(true);

    await page.screenshot({
      path: `output/playwright/portfolio-${viewport.name}.png`,
      fullPage: true,
    });
  });
}

test("English portfolio copy stays inside the mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en");

  await expect(
    page.locator(".hero-role").getByText(
      "Senior frontend engineer expanding into full-stack and Agent engineering",
    ),
  ).toBeVisible();

  const widths = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));

  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
});
