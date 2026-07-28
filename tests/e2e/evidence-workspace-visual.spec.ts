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

    const claims = page.locator("#workspace-panel-claims article");
    const evidenceLessClaim = page.getByRole("article", {
      name: "没有证据关系的主张仍需人工审核。",
    });
    await expect(claims).toHaveCount(5);
    await evidenceLessClaim.scrollIntoViewIfNeeded();
    await expect(evidenceLessClaim.getByText("0 条证据", { exact: true })).toBeVisible();
    const claimMetrics = await page.evaluate(() => {
      const claimPanel = document.querySelector<HTMLElement>("#workspace-panel-claims");
      const claimCards = Array.from(
        document.querySelectorAll<HTMLElement>("#workspace-panel-claims article"),
      );
      const panelBounds = claimPanel?.getBoundingClientRect();

      return {
        count: claimCards.length,
        cardsInsidePanel: claimCards.every((card) => {
          const bounds = card.getBoundingClientRect();
          return (
            !panelBounds ||
            (bounds.left >= panelBounds.left - 1 && bounds.right <= panelBounds.right + 1)
          );
        }),
      };
    });

    expect(claimMetrics.count).toBe(5);
    expect(claimMetrics.cardsInsidePanel).toBe(true);
    await page.locator("#workspace-panel-claims").screenshot({
      path: `output/playwright/evidence-workspace-claims-${viewport.name}.png`,
    });

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
      "[data-selected='true']",
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
    const reportBeforeReadiness = await page
      .getByTestId("workspace-report")
      .boundingBox();
    await page.getByLabel("报告版本").selectOption("workspace_report_pending_zh");
    await expect(page.getByText("还需审核 2 条报告引用主张")).toBeVisible();
    await expect(page.getByRole("button", { name: "发布此版本" })).toHaveCount(0);
    const reportMetrics = await page.evaluate(() => {
      const report = document.querySelector<HTMLElement>('[data-testid="workspace-report"]');
      const documentBody = report?.querySelector<HTMLElement>("article");
      const readiness = report?.querySelector<HTMLElement>("[data-state='incomplete']");
      const readinessText = readiness?.querySelector<HTMLElement>("p");
      const controls = Array.from(
        report?.querySelectorAll<HTMLElement>("button, select") ?? [],
      ).filter((control) => {
        const bounds = control.getBoundingClientRect();
        const style = getComputedStyle(control);
        return style.display !== "none" && bounds.width > 0 && bounds.height > 0;
      });
      const controlsOverlap = controls.some((control, index) => {
        const first = control.getBoundingClientRect();

        return controls.slice(index + 1).some((candidate) => {
          const second = candidate.getBoundingClientRect();
          return !(
            first.right <= second.left ||
            second.right <= first.left ||
            first.bottom <= second.top ||
            second.bottom <= first.top
          );
        });
      });

      return {
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        reportWidth: report?.getBoundingClientRect().width ?? 0,
        reportHeight: report?.getBoundingClientRect().height ?? 0,
        documentHeight: documentBody?.getBoundingClientRect().height ?? 0,
        readinessTextClipped:
          Boolean(readinessText) &&
          ((readinessText?.scrollWidth ?? 0) > (readinessText?.clientWidth ?? 0) + 1 ||
            (readinessText?.scrollHeight ?? 0) > (readinessText?.clientHeight ?? 0) + 1),
        controlsOverlap,
      };
    });
    const reportAfterReadiness = await page
      .getByTestId("workspace-report")
      .boundingBox();
    const pendingAudit = await inspectVisibleUi(page, [
      "[data-testid='workspace-report'] [data-state='incomplete']",
    ]);

    expect(reportMetrics.documentWidth).toBeLessThanOrEqual(reportMetrics.viewportWidth);
    expect(reportMetrics.reportWidth).toBeGreaterThan(viewport.name === "mobile" ? 340 : 360);
    expect(reportMetrics.reportHeight).toBeGreaterThan(480);
    expect(reportMetrics.documentHeight).toBeGreaterThan(240);
    expect(reportMetrics.readinessTextClipped).toBe(false);
    expect(reportMetrics.controlsOverlap).toBe(false);
    expect(reportAfterReadiness?.width).toBe(reportBeforeReadiness?.width);
    expect(
      (reportAfterReadiness?.height ?? 0) - (reportBeforeReadiness?.height ?? 0),
    ).toBeGreaterThanOrEqual(0);
    expect(
      (reportAfterReadiness?.height ?? 0) - (reportBeforeReadiness?.height ?? 0),
    ).toBeLessThanOrEqual(16);
    expect(pendingAudit.documentWidth).toBeLessThanOrEqual(pendingAudit.viewportWidth);
    expect(pendingAudit.fontSizeViolations).toEqual([]);
    expect(pendingAudit.leftRuleViolations).toEqual([]);
    await page.screenshot({
      path: `output/playwright/evidence-workspace-report-pending-${viewport.name}.png`,
      fullPage: false,
    });

    await page.getByRole("button", { name: "审核下一条" }).click();
    const firstClaim = page.getByRole("article", {
      name: "精确原文让审核者可以逐条核查 AI 研究主张。",
    });
    await firstClaim.getByRole("button", { name: "接受主张" }).click();
    const secondClaim = page.getByRole("article", {
      name: "只有页面级链接也足以证明报告中的事实段落。",
    });
    await secondClaim.getByRole("button", { name: "拒绝主张" }).click();

    if (viewport.name === "mobile") {
      await page
        .getByRole("tablist", { name: "工作台视图" })
        .getByRole("tab", { name: "图谱", exact: true })
        .click();
    }

    await expect(page.getByLabel("报告版本")).toHaveValue(
      "workspace_report_pending_zh",
    );
    await expect(
      page.getByText("发布时将排除涉及 2 条已拒绝主张的段落。"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "发布此版本" })).toHaveCount(0);
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, 0);
    });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    const reviewedAudit = await inspectVisibleUi(page, [
      "[data-testid='workspace-report'] [data-state='ready']",
    ]);
    expect(reviewedAudit.documentWidth).toBeLessThanOrEqual(reviewedAudit.viewportWidth);
    expect(reviewedAudit.fontSizeViolations).toEqual([]);
    expect(reviewedAudit.leftRuleViolations).toEqual([]);
    await page.screenshot({
      path: `output/playwright/evidence-workspace-report-reviewed-${viewport.name}.png`,
      fullPage: false,
    });
  });
}
