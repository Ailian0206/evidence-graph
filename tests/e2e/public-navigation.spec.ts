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
