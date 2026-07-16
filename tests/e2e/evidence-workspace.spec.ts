import { expect, test } from "@playwright/test";

test.describe("evidence workspace routes", () => {
  test("opens the Chinese deterministic workspace from the product preview", async ({
    page,
  }) => {
    await page.goto("/zh/evidence");
    await page.getByRole("link", { name: "打开示例工作台" }).click();

    await expect(page).toHaveURL(/\/zh\/app\/research\/demo$/);
    await expect(
      page.getByRole("heading", {
        name: "可追溯引用是否让 AI 研究更容易审核？",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator('[data-workspace-state="ready"]')).toBeVisible();
  });

  test("renders the English deterministic workspace", async ({ page }) => {
    await page.goto("/en/app/research/demo");

    await expect(
      page.getByRole("heading", {
        name: "Do traceable citations make AI research easier to review?",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator('[data-workspace-state="ready"]')).toBeVisible();
    await expect(page.locator("body")).not.toContainText("打开示例工作台");
  });

  test("renders a non-indexable state for an unknown research project", async ({
    page,
  }) => {
    await page.goto("/zh/app/research/missing");

    await expect(page.locator('[data-workspace-state="not-found"]')).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "没有找到这个研究项目" }),
    ).toBeVisible();
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
      "content",
      /noindex/,
    );
  });
});
