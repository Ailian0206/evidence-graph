import { expect, test } from "@playwright/test";

test("visitor can open the Chinese portfolio and navigate to selected work", async ({
  page,
}) => {
  await page.goto("/zh");

  await expect(page.getByRole("heading", { name: "Ailian", exact: true })).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "作品", exact: true })
    .click();

  await expect(page).toHaveURL(/\/zh\/work$/);
  await expect(page.getByRole("heading", { name: "精选作品" })).toBeVisible();
});

test("mobile navigation opens, marks the current page, and closes with Escape", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/zh/work");

  const menuButton = page.getByRole("button", { name: "打开菜单" });
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await menuButton.click();

  const navigation = page.getByRole("navigation", { name: "主导航" });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole("link", { name: "作品", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.keyboard.press("Escape");
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await expect(menuButton).toBeFocused();
});

test("skip link moves keyboard focus to the localized main content", async ({ page }) => {
  await page.goto("/zh");
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "跳到主要内容" });
  await expect(skipLink).toBeFocused();
  await skipLink.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});
