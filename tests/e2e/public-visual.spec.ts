import { expect, test } from "@playwright/test";

import { inspectVisibleUi } from "./support/ui-visual-audit";

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
    if (viewport.name === "mobile") {
      await expect(page.getByRole("button", { name: "打开菜单" })).toBeVisible();
    } else {
      await expect(
        page
          .getByRole("navigation")
          .getByRole("link", { name: "Evidence Graph", exact: true }),
      ).toBeVisible();
    }
    await expect(page.locator(".evidence-canvas-hero .canvas-inspector")).toBeVisible();

    const metrics = await page.evaluate(() => {
      const header = document.querySelector<HTMLElement>(".site-header");
      const hero = document.querySelector<HTMLElement>(".portfolio-hero");
      const selectedWork = document.querySelector<HTMLElement>("#selected-work");
      const graphNode = document.querySelector<HTMLElement>(".graph-node");
      const canvas = document.querySelector<HTMLElement>(".evidence-canvas");
      const heroContent = document.querySelector<HTMLElement>(".hero-content");
      const heroScroll = document.querySelector<HTMLElement>(".hero-scroll");
      const heroInspector = document.querySelector<HTMLElement>(
        ".evidence-canvas-hero .canvas-inspector",
      );
      const heroNodes = Array.from(
        document.querySelectorAll<HTMLElement>(".evidence-canvas-hero .graph-node"),
      );

      if (
        !header ||
        !hero ||
        !selectedWork ||
        !graphNode ||
        !canvas ||
        !heroContent ||
        !heroScroll ||
        !heroInspector
      ) {
        throw new Error("visual contract elements are missing");
      }

      const heroScrollBounds = heroScroll.getBoundingClientRect();
      const heroInspectorBounds = heroInspector.getBoundingClientRect();
      const heroCopyBounds = Array.from(heroContent.children).map((element) =>
        element.getBoundingClientRect(),
      );
      const heroNodeBounds = heroNodes.map((node) => node.getBoundingClientRect());
      const rectanglesOverlap = (left: DOMRect, right: DOMRect) =>
        !(
          left.right <= right.left ||
          left.left >= right.right ||
          left.bottom <= right.top ||
          left.top >= right.bottom
        );

      return {
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        headerHeight: header.getBoundingClientRect().height,
        heroHeight: hero.getBoundingClientRect().height,
        selectedWorkTop: selectedWork.getBoundingClientRect().top,
        graphNodePosition: getComputedStyle(graphNode).position,
        canvasBackground: getComputedStyle(canvas).backgroundColor,
        heroControlsOverlap: rectanglesOverlap(heroScrollBounds, heroInspectorBounds),
        heroTextOverlapsNodes: heroCopyBounds.some((copyBounds) =>
          heroNodeBounds.some((nodeBounds) => rectanglesOverlap(copyBounds, nodeBounds)),
        ),
        heroNodesInsideViewport: heroNodes.every((node) => {
          const bounds = node.getBoundingClientRect();
          return bounds.left >= 0 && bounds.right <= window.innerWidth;
        }),
      };
    });
    const audit = await inspectVisibleUi(page);

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.headerHeight).toBeGreaterThanOrEqual(56);
    expect(metrics.headerHeight).toBeLessThanOrEqual(80);
    expect(metrics.heroHeight).toBeGreaterThanOrEqual(620);
    expect(metrics.heroHeight).toBeLessThanOrEqual(760);
    expect(metrics.selectedWorkTop).toBeLessThan(metrics.viewportHeight);
    expect(metrics.graphNodePosition).toBe("absolute");
    expect(metrics.canvasBackground).not.toBe("rgba(0, 0, 0, 0)");
    expect(metrics.heroControlsOverlap).toBe(false);
    expect(metrics.heroTextOverlapsNodes).toBe(false);
    expect(metrics.heroNodesInsideViewport).toBe(true);
    expect(audit.documentWidth).toBeLessThanOrEqual(audit.viewportWidth);
    expect(audit.fontSizeViolations).toEqual([]);

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

test("mobile hero graph nodes remain interactive", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/zh");

  const sourceNode = page.locator(".evidence-canvas-hero .graph-node-source");
  await sourceNode.click({ timeout: 2000 });

  await expect(page.locator(".evidence-canvas-hero .canvas-inspector")).toContainText(
    "2026-07-12 获取 · 一手访谈",
  );
});
