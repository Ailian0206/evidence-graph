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
