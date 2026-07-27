import { expect, test } from "@playwright/test";

test.describe("managed project workspace routes", () => {
  test("protects the Chinese project dashboard", async ({ page }) => {
    await page.goto("/zh/app");

    await expect(page).toHaveURL(/\/zh\/auth\/login\?next=%2Fzh%2Fapp$/);
    await expect(page.getByRole("heading", { name: "登录 Evidence Graph" })).toBeVisible();
  });

  test("protects the localized new research form", async ({ page }) => {
    await page.goto("/en/app/research/new");

    await expect(page).toHaveURL(
      /\/en\/auth\/login\?next=%2Fen%2Fapp%2Fresearch%2Fnew$/,
    );
    await expect(page.getByRole("heading", { name: "Sign in to Evidence Graph" })).toBeVisible();
  });

  test("protects the report library", async ({ page }) => {
    await page.goto("/zh/app/reports");

    await expect(page).toHaveURL(/\/zh\/auth\/login\?next=%2Fzh%2Fapp%2Freports$/);
    await expect(page.getByRole("heading", { name: "登录 Evidence Graph" })).toBeVisible();
  });
});
