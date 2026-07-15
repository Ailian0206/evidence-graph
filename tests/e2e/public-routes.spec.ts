import { expect, test } from "@playwright/test";

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

test("evidence preview exposes inspectable source state", async ({ page }) => {
  await page.goto("/zh/evidence");

  const sourceNode = page.locator(".evidence-canvas-workspace .graph-node-source");
  await sourceNode.click();

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
  const backLink = page.getByRole("link", { name: "返回作品集" });
  const inspector = page.locator(".canvas-inspector");

  await claimNode.hover();
  await expect(claimNode).toHaveAttribute("aria-pressed", "true");
  await expect(inspector).toContainText("待审核主张 · 2 条支持证据");

  await page.mouse.move(4, 4);
  await expect(claimNode).toHaveAttribute("aria-pressed", "false");
  await expect(inspector).toContainText("精确匹配 · 第 18 段");

  await claimNode.focus();
  await expect(claimNode).toHaveAttribute("aria-pressed", "true");

  await backLink.focus();
  await expect(claimNode).toHaveAttribute("aria-pressed", "false");
  await expect(inspector).toContainText("精确匹配 · 第 18 段");

  await evidenceNode.focus();
  await expect(evidenceNode).toHaveAttribute("aria-pressed", "true");
  await expect(inspector).toContainText("精确匹配 · 第 18 段");
});
