import { expect, test } from "@playwright/test";

import { inspectVisibleUi } from "./support/ui-visual-audit";

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 1000 },
] as const;

const visualRoutes = [
  { path: "/zh", name: "home-zh" },
  { path: "/en", name: "home-en" },
  { path: "/zh/work", name: "work-zh" },
  { path: "/zh/work/evidence-graph", name: "case-evidence-zh" },
  { path: "/zh/notes", name: "notes-zh" },
  { path: "/zh/evidence", name: "evidence-zh" },
  { path: "/zh/auth/login", name: "login-zh" },
  { path: "/zh/app/research/demo", name: "workspace-zh" },
  { path: "/r/traceable-citations-review-zh", name: "report-zh" },
] as const;

const leftRuleSelectors = [
  ".project-proof",
  "[data-testid='selected-claim']",
  "[data-testid='workspace-source'] blockquote",
  "[data-testid='workspace-report'] q",
  "[data-run-log-entry]",
  "[data-public-report-section='true']",
  "[data-public-citations='true'] blockquote",
];

for (const viewport of viewports) {
  for (const route of visualRoutes) {
    test(`${route.name} passes the UI refresh contract at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(route.path);

      const audit = await inspectVisibleUi(page, leftRuleSelectors);
      expect(audit.documentWidth).toBeLessThanOrEqual(audit.viewportWidth);
      expect(audit.fontSizeViolations).toEqual([]);
      expect(audit.leftRuleViolations).toEqual([]);

      await page.screenshot({
        path: `output/playwright/ui-refresh/${route.name}-${viewport.name}.png`,
        fullPage: true,
      });
    });
  }
}
