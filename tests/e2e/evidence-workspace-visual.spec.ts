import { expect, test } from "@playwright/test";

import { inspectVisibleUi } from "./support/ui-visual-audit";

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 1000 },
] as const;

for (const viewport of viewports) {
  test(`evidence workspace remains stable at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/zh/app/research/demo");

    if (viewport.name === "mobile") {
      await page
        .getByRole("tablist", { name: "工作台视图" })
        .getByRole("tab", { name: "图谱", exact: true })
        .click();
    }

    const graph = page.getByTestId("workspace-graph");
    await expect(graph).toHaveAttribute("data-graph-ready", "true");
    const graphBeforeSelection = await graph.boundingBox();
    await page
      .getByRole("button", {
        name: "证据：只有在来源正文完整保存并显示限定条件时才成立",
      })
      .click();
    const graphAfterSelection = await graph.boundingBox();

    expect(graphBeforeSelection).not.toBeNull();
    expect(graphAfterSelection).not.toBeNull();
    expect(graphAfterSelection?.width).toBe(graphBeforeSelection?.width);
    expect(graphAfterSelection?.height).toBe(graphBeforeSelection?.height);
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, 0);
    });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

    const metrics = await page.evaluate(() => {
      const graphRoot = document.querySelector<HTMLElement>('[data-testid="workspace-graph"]');
      const siteHeader = document.querySelector<HTMLElement>(".site-header");
      const projectBar = document.querySelector<HTMLElement>(
        '[data-workspace-state="ready"] > header',
      );
      const visiblePanels = Array.from(
        document.querySelectorAll<HTMLElement>(
          "#workspace-panel-claims, #workspace-panel-graph, #workspace-panel-source, #workspace-panel-log",
        ),
      ).filter((panel) => getComputedStyle(panel).display !== "none");
      const canvases = graphRoot
        ? Array.from(graphRoot.querySelectorAll("canvas")).filter(
            (candidate) => candidate.width > 0 && candidate.height > 0,
          )
        : [];
      const coloredSamples = canvases.reduce((maximum, canvas) => {
        const context = canvas.getContext("2d");

        if (!context) {
          return maximum;
        }

        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const stride = Math.max(4, Math.floor(pixels.length / 5000 / 4) * 4);
        let currentSamples = 0;

        for (let index = 0; index < pixels.length; index += stride) {
          if (pixels[index + 3] > 0) {
            currentSamples += 1;
          }
        }

        return Math.max(maximum, currentSamples);
      }, 0);

      const graphBounds = graphRoot?.getBoundingClientRect();
      const siteHeaderBounds = siteHeader?.getBoundingClientRect();
      const projectBarBounds = projectBar?.getBoundingClientRect();

      return {
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        graphWidth: graphBounds?.width ?? 0,
        graphHeight: graphBounds?.height ?? 0,
        canvasFound: canvases.length > 0,
        coloredSamples,
        visiblePanelCount: visiblePanels.length,
        panelsInsideViewport: visiblePanels.every((panel) => {
          const bounds = panel.getBoundingClientRect();
          return bounds.left >= 0 && bounds.right <= window.innerWidth + 1;
        }),
        siteHeaderTop: siteHeaderBounds?.top ?? -1,
        siteHeaderBottom: siteHeaderBounds?.bottom ?? -1,
        projectBarTop: projectBarBounds?.top ?? -1,
      };
    });
    const audit = await inspectVisibleUi(page, [
      "[data-testid='selected-claim']",
      "[data-testid='workspace-source'] blockquote",
      "[data-testid='workspace-report'] q",
      "[data-run-log-entry]",
    ]);

    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.graphWidth).toBeGreaterThan(viewport.name === "mobile" ? 340 : 360);
    expect(metrics.graphHeight).toBeGreaterThan(400);
    expect(metrics.canvasFound).toBe(true);
    expect(metrics.coloredSamples).toBeGreaterThan(20);
    expect(metrics.panelsInsideViewport).toBe(true);
    expect(metrics.visiblePanelCount).toBe(viewport.name === "mobile" ? 1 : 4);
    expect(metrics.siteHeaderTop).toBeGreaterThanOrEqual(0);
    expect(metrics.siteHeaderTop).toBeLessThanOrEqual(1);
    expect(metrics.projectBarTop).toBeGreaterThanOrEqual(metrics.siteHeaderBottom - 1);
    expect(audit.documentWidth).toBeLessThanOrEqual(audit.viewportWidth);
    expect(audit.fontSizeViolations).toEqual([]);
    expect(audit.leftRuleViolations).toEqual([]);

    await page.screenshot({
      path: `output/playwright/evidence-workspace-${viewport.name}.png`,
      fullPage: false,
    });

    await page.getByRole("tab", { name: "报告", exact: true }).click();
    const reportMetrics = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      reportWidth:
        document.querySelector<HTMLElement>('[data-testid="workspace-report"]')
          ?.getBoundingClientRect().width ?? 0,
    }));

    expect(reportMetrics.documentWidth).toBeLessThanOrEqual(reportMetrics.viewportWidth);
    expect(reportMetrics.reportWidth).toBeGreaterThan(viewport.name === "mobile" ? 340 : 360);
    await page.screenshot({
      path: `output/playwright/evidence-workspace-report-${viewport.name}.png`,
      fullPage: false,
    });
  });
}
