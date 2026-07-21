import { expect, test } from "@playwright/test";

test.describe("public report publishing", () => {
  test("opens a frozen Chinese report without a locale redirect", async ({ page }) => {
    await page.goto("/r/traceable-citations-review-zh");

    await expect(page).toHaveURL(/\/r\/traceable-citations-review-zh$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "zh");
    await expect(
      page.getByRole("heading", {
        name: "可追溯引用是否让 AI 研究更容易审核？",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /打开原始来源/ }).first()).toHaveAttribute(
      "href",
      /^https:\/\//,
    );
  });

  test("renders the English snapshot from its own stable slug", async ({ page }) => {
    await page.goto("/r/traceable-citations-review-en");

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("heading", {
        name: "Do traceable citations make AI research easier to review?",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy public link" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Print report" })).toBeVisible();
  });

  test("publishes canonical and article metadata from the immutable snapshot", async ({ page }) => {
    await page.goto("/r/traceable-citations-review-zh");

    await expect(page).toHaveTitle("可追溯引用是否让 AI 研究更容易审核？");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/r\/traceable-citations-review-zh$/,
    );
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
      "content",
      "article",
    );
    await expect(page.locator('meta[property="article:published_time"]')).toHaveAttribute(
      "content",
      "2026-07-17T10:00:00.000Z",
    );
  });

  test("returns 404 for an unavailable report", async ({ request }) => {
    const response = await request.get("/r/missing-report", { maxRedirects: 0 });

    expect(response.status()).toBe(404);
    expect(response.headers().location).toBeUndefined();
  });
});
