import { expect, test } from "@playwright/test";

import { inspectVisibleUi } from "./support/ui-visual-audit";

test.describe("managed authentication boundary", () => {
  test("keeps the deterministic demo public", async ({ page }) => {
    await page.goto("/zh/app/research/demo");

    await expect(
      page.getByRole("heading", {
        name: "可追溯引用是否让 AI 研究更容易审核？",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/zh\/app\/research\/demo$/);
  });

  test("redirects managed research routes to localized login", async ({ page }) => {
    await page.goto("/zh/app/research/private-project");

    await expect(page).toHaveURL(
      /\/zh\/auth\/login\?next=%2Fzh%2Fapp%2Fresearch%2Fprivate-project$/,
    );
    await expect(page.getByRole("heading", { name: "登录 Evidence Graph" })).toBeVisible();
    await expect(page.getByRole("button", { name: "使用 GitHub 登录" })).toBeDisabled();
    await expect(page.getByText("托管登录尚未配置")).toBeVisible();
  });

  test("keeps English auth copy localized", async ({ page }) => {
    await page.goto("/en/app/research/private-project");

    await expect(page).toHaveURL(
      /\/en\/auth\/login\?next=%2Fen%2Fapp%2Fresearch%2Fprivate-project$/,
    );
    await expect(page.getByRole("heading", { name: "Sign in to Evidence Graph" })).toBeVisible();
    await expect(page.getByText("Managed sign-in is not configured")).toBeVisible();
  });

  test("keeps localized login states accessible and stable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/zh/auth/login?error=oauth");

    await expect(page.getByRole("heading", { name: "登录 Evidence Graph" })).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("托管登录尚未配置");
    await expect(page.locator("p[role='alert']")).toHaveText("登录没有完成，请重新尝试。");

    const audit = await inspectVisibleUi(page);
    expect(audit.documentWidth).toBeLessThanOrEqual(audit.viewportWidth);
    expect(audit.fontSizeViolations).toEqual([]);
    await page.screenshot({ path: "output/playwright/login-mobile.png", fullPage: true });
  });
});
