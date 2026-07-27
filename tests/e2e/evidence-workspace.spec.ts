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

  test("does not disclose an unknown research project to anonymous users", async ({
    page,
  }) => {
    await page.goto("/zh/app/research/missing");

    await expect(page).toHaveURL(
      /\/zh\/auth\/login\?next=%2Fzh%2Fapp%2Fresearch%2Fmissing$/,
    );
  });

  test("uses localized Chinese panel labels", async ({ page }) => {
    await page.goto("/zh/app/research/demo");

    for (const label of ["Claims", "Graph", "Source", "Run Log"]) {
      await expect(page.getByText(label, { exact: true })).toHaveCount(0);
    }
    await expect(page.getByText("主张列表", { exact: true })).toBeVisible();
    await expect(page.getByText("证据图谱", { exact: true })).toBeVisible();
  });
});

test.describe("evidence workspace graph", () => {
  test("selects an evidence node and synchronizes its claim and source", async ({
    page,
  }) => {
    await page.goto("/zh/app/research/demo");

    const graph = page.getByTestId("workspace-graph");
    await expect(graph).toHaveAttribute("data-graph-ready", "true");
    await page
      .getByRole("button", {
        name: "证据：只保留页面级链接不足以证明事实段落",
      })
      .click();

    await expect(
      page.getByRole("button", {
        name: "只有页面级链接也足以证明报告中的事实段落。",
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("workspace-source")).toContainText(
      "可引用报告的产品约束与反例记录",
    );
    await expect(page.getByTestId("workspace-source")).toContainText(
      "只保留页面级链接不足以证明事实段落",
    );
  });

  test("removes disabled evidence relations from the graph and claim list", async ({
    page,
  }) => {
    await page.goto("/zh/app/research/demo");

    const graph = page.getByTestId("workspace-graph");
    const initialElementCount = Number(await graph.getAttribute("data-graph-elements"));
    await page.getByRole("checkbox", { name: "反驳" }).click();

    await expect(page.getByRole("checkbox", { name: "反驳" })).not.toBeChecked();
    await expect(
      page.getByRole("button", {
        name: "只有页面级链接也足以证明报告中的事实段落。",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect
      .poll(async () => Number(await graph.getAttribute("data-graph-elements")))
      .toBeLessThan(initialElementCount);
  });

  test("selects graph nodes with arrow keys and Enter", async ({ page }) => {
    await page.goto("/zh/app/research/demo");

    const graph = page.getByRole("application", {
      name: "证据关系图，使用方向键浏览节点，按回车选择",
    });
    await graph.focus();
    await graph.press("ArrowRight");
    await graph.press("ArrowRight");
    await graph.press("Enter");

    await expect(
      page.getByRole("button", {
        name: "只有页面级链接也足以证明报告中的事实段落。",
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("workspace-source")).toContainText(
      "可引用报告的产品约束与反例记录",
    );
  });
});

test.describe("evidence workspace report", () => {
  test("opens a report deep link in the mobile report panel", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/zh/app/research/demo?view=report");

    await expect(
      page
        .getByRole("tablist", { name: "工作台视图" })
        .getByRole("tab", { name: "图谱", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      page
        .getByRole("tablist", { name: "图谱内容" })
        .getByRole("tab", { name: "报告", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel", { name: "图谱", exact: true })).toBeVisible();
    await expect(page.getByTestId("workspace-report")).toBeVisible();
  });

  test("opens a deterministic report and follows a citation back to its evidence", async ({
    page,
  }) => {
    await page.goto("/zh/app/research/demo");
    await page.getByRole("tab", { name: "报告", exact: true }).click();

    await expect(
      page.getByRole("heading", { name: "精确引用降低核查成本" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "可引用报告的产品约束与反例记录" })
      .click();

    await expect(
      page.getByRole("button", {
        name: "只有页面级链接也足以证明报告中的事实段落。",
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("workspace-source")).toContainText(
      "只保留页面级链接不足以证明事实段落",
    );
  });
});

test.describe("evidence workspace claim review", () => {
  test("keeps review actions with the selected claim and supports undo", async ({
    page,
  }) => {
    await page.goto("/zh/app/research/demo");

    const firstClaim = page.getByRole("article", {
      name: "精确原文让审核者可以逐条核查 AI 研究主张。",
    });
    const nextClaim = page.getByRole("article", {
      name: "只有页面级链接也足以证明报告中的事实段落。",
    });

    await expect(firstClaim).toHaveAttribute("data-selected", "true");
    await expect(firstClaim.getByRole("button", { name: "接受主张" })).toBeVisible();
    await expect(nextClaim.getByRole("button", { name: "接受主张" })).toHaveCount(0);

    await firstClaim.getByRole("button", { name: "接受主张" }).click();

    await expect(firstClaim).toHaveAttribute("data-selected", "false");
    await expect(firstClaim.getByText("已接受", { exact: true })).toBeVisible();
    await expect(nextClaim).toHaveAttribute("data-selected", "true");
    await expect(
      nextClaim.getByRole("button", { name: "撤销上一条审核" }),
    ).toBeVisible();

    await nextClaim.getByRole("button", { name: "撤销上一条审核" }).click();

    await expect(firstClaim).toHaveAttribute("data-selected", "true");
    await expect(firstClaim.getByText("待审核", { exact: true })).toBeVisible();
    await expect(firstClaim.getByRole("button", { name: "接受主张" })).toBeVisible();
  });
});

test.describe("evidence workspace responsive navigation", () => {
  test("switches the four mobile workspace tabs with keyboard controls", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/zh/app/research/demo");

    const workspaceTabs = page.getByRole("tablist", { name: "工作台视图" });
    const claimsTab = workspaceTabs.getByRole("tab", { name: "主张", exact: true });
    const graphTab = workspaceTabs.getByRole("tab", { name: "图谱", exact: true });
    const sourceTab = workspaceTabs.getByRole("tab", { name: "来源", exact: true });
    const logTab = workspaceTabs.getByRole("tab", { name: "日志", exact: true });
    await expect(workspaceTabs.getByRole("tab")).toHaveCount(4);
    await expect(claimsTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel", { name: "主张" })).toBeVisible();
    await expect(page.getByRole("tabpanel", { name: "图谱", exact: true })).toBeHidden();

    await claimsTab.focus();
    await claimsTab.press("ArrowRight");
    await expect(graphTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel", { name: "图谱", exact: true })).toBeVisible();
    await expect(page.getByRole("tabpanel", { name: "来源", exact: true })).toBeHidden();

    await sourceTab.click();
    await expect(page.getByRole("tabpanel", { name: "来源", exact: true })).toBeVisible();

    await logTab.click();
    await expect(page.getByRole("tabpanel", { name: "日志", exact: true })).toBeVisible();
  });

  test("expands the run log and exposes every deterministic workflow step", async ({
    page,
  }) => {
    await page.goto("/zh/app/research/demo");

    await page.getByRole("button", { name: "展开运行日志" }).click();

    await expect(page.getByRole("list", { name: "研究运行步骤" }).getByRole("listitem"))
      .toHaveCount(8);
    await expect(page.getByRole("button", { name: "收起运行日志" })).toBeVisible();
  });
});
