import { expect, test } from "@playwright/test";

import { inspectVisibleUi } from "./support/ui-visual-audit";

const publicRoutes = [
  { path: "/zh", heading: "Ailian", screenshot: "home-zh" },
  { path: "/en", heading: "Ailian", screenshot: "home-en" },
  { path: "/zh/work", heading: "精选作品", screenshot: "work-zh" },
  { path: "/zh/notes", heading: "工程笔记", screenshot: "notes-zh" },
  { path: "/zh/evidence", heading: "Evidence Graph", screenshot: "evidence-zh" },
  {
    path: "/zh/work/evidence-graph",
    heading: "Evidence Graph",
    screenshot: "case-evidence-zh",
  },
  {
    path: "/zh/work/ai-photo-studio-cn",
    heading: "AI Photo Studio CN",
    screenshot: "case-photo-zh",
  },
] as const;

for (const route of publicRoutes) {
  test(`${route.path} renders its public heading`, async ({ page }) => {
    await page.goto(route.path);

    await expect(
      page.getByRole("heading", { name: route.heading, exact: true }).first(),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Create Next App");

    await page.screenshot({
      path: `output/playwright/routes/${route.screenshot}.png`,
      fullPage: true,
    });
  });
}

test("invalid locale prefixes return 404 without redirecting", async ({ request }) => {
  for (const path of ["/fr", "/fr/notes"]) {
    const response = await request.get(path, { maxRedirects: 0 });

    expect(response.status()).toBe(404);
    expect(response.headers().location).toBeUndefined();
  }
});

test("evidence preview exposes inspectable source state", async ({ page }) => {
  await page.goto("/zh/evidence");

  const sourceNode = page.locator(".evidence-canvas-workspace .graph-node-source");
  await sourceNode.click();

  await expect(sourceNode).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".canvas-inspector")).toContainText(
    "2026-07-12 获取 · 一手访谈",
  );
});

test("evidence preview keeps a clicked selection after pointer leave", async ({ page }) => {
  await page.goto("/zh/evidence");

  const sourceNode = page.locator(".evidence-canvas-workspace .graph-node-source");
  await sourceNode.click();
  await page.mouse.move(4, 4);

  await expect(sourceNode).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".canvas-inspector")).toContainText(
    "2026-07-12 获取 · 一手访谈",
  );
});

test("Chinese public pages localize metadata and secondary labels", async ({ page }) => {
  await page.goto("/zh/notes");

  await expect(page).toHaveTitle("工程笔记 | Ailian");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "我把复杂的 AI 工作流做成可理解、可验证、可持续维护的产品。当前重点是 Evidence Graph：让研究结论回到原文证据。",
  );
  await expect(page.locator(".note-row").first().locator("p").first()).toHaveText(
    "草稿",
  );
  await expect(page.locator("body")).not.toContainText("Research");
  await expect(page.locator("body")).not.toContainText("Draft");

  await page.goto("/zh/evidence");

  await expect(page.locator(".evidence-canvas-workspace .canvas-status")).toContainText(
    "运行 01 / 证据审核",
  );

  await page.goto("/zh/work");
  await expect(page).toHaveTitle("精选作品 | Ailian");
});

test("evidence preview keeps hover and focus state aligned", async ({ page }) => {
  await page.goto("/zh/evidence");

  const claimNode = page.locator(".evidence-canvas-workspace .graph-node-claim");
  const evidenceNode = page.locator(".evidence-canvas-workspace .graph-node-evidence");
  const graphPlane = page.locator(".evidence-canvas-workspace .graph-plane");
  const backLink = page.getByRole("link", { name: "返回作品集" });
  const inspector = page.locator(".canvas-inspector");

  await claimNode.hover();
  await expect(graphPlane).toHaveAttribute("data-active-node", "claim");
  await expect(claimNode).toHaveAttribute("aria-pressed", "false");
  await expect(inspector).toContainText("待审核主张 · 2 条支持证据");

  await graphPlane.hover({ position: { x: 8, y: 160 } });
  await expect(graphPlane).toHaveAttribute("data-active-node", "evidence");
  await expect(inspector).toContainText("精确匹配 · 第 18 段");

  await claimNode.focus();
  await expect(graphPlane).toHaveAttribute("data-active-node", "claim");
  await expect(claimNode).toHaveAttribute("aria-pressed", "false");

  await claimNode.hover();
  await graphPlane.hover({ position: { x: 8, y: 160 } });
  await expect(graphPlane).toHaveAttribute("data-active-node", "claim");
  await expect(inspector).toContainText("待审核主张 · 2 条支持证据");

  await backLink.focus();
  await expect(graphPlane).toHaveAttribute("data-active-node", "evidence");
  await expect(inspector).toContainText("精确匹配 · 第 18 段");

  await evidenceNode.focus();
  await expect(evidenceNode).toHaveAttribute("aria-pressed", "true");
  await expect(inspector).toContainText("精确匹配 · 第 18 段");
});

test("Chinese portfolio sections do not expose English structural labels", async ({
  page,
}) => {
  const routes = ["/zh", "/zh/work", "/zh/notes", "/zh/work/evidence-graph"];

  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator("body")).not.toContainText(
      /01 \/ Work|02 \/ Notes|03 \/ About|Case study|01 \/ Problem|02 \/ Approach|03 \/ Proof/,
    );
  }
});

test("work, notes, and case pages keep balanced-density rows", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });

  for (const route of ["/zh/work", "/zh/notes", "/zh/work/evidence-graph"]) {
    await page.goto(route);
    const audit = await inspectVisibleUi(page, [".project-proof"]);
    expect(audit.documentWidth).toBeLessThanOrEqual(audit.viewportWidth);
    expect(audit.fontSizeViolations).toEqual([]);
    expect(audit.leftRuleViolations).toEqual([]);
  }
});

test("Evidence Graph case study shows the real graph and public report entry", async ({
  page,
}) => {
  await page.goto("/zh/work/evidence-graph");

  await expect(page.locator(".evidence-canvas-workspace")).toBeVisible();
  await expect(page.getByRole("link", { name: "查看公开报告" })).toHaveAttribute(
    "href",
    "/r/traceable-citations-review-zh",
  );
});

test("mobile evidence preview keeps controls clear of the graph", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/zh/evidence");

  await expect(page.locator("body")).not.toContainText("Product preview");
  const metrics = await page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>(".evidence-canvas-workspace .graph-node"),
    );
    const inspector = document.querySelector<HTMLElement>(
      ".evidence-canvas-workspace .canvas-inspector",
    );
    const inspectorBounds = inspector?.getBoundingClientRect();
    const overlaps = (left: DOMRect, right: DOMRect) =>
      !(
        left.right <= right.left ||
        left.left >= right.right ||
        left.bottom <= right.top ||
        left.top >= right.bottom
      );

    return {
      targetsAreStable: nodes.every((node) => {
        const bounds = node.getBoundingClientRect();
        return bounds.width >= 40 && bounds.height >= 40;
      }),
      inspectorOverlapsNode:
        inspectorBounds !== undefined &&
        nodes.some((node) => overlaps(inspectorBounds, node.getBoundingClientRect())),
    };
  });

  expect(metrics.targetsAreStable).toBe(true);
  expect(metrics.inspectorOverlapsNode).toBe(false);
});
