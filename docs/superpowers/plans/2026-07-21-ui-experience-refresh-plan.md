# 全站 UI 体验优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变研究、权限、发布和 Provider 契约的前提下，把作品集、认证、项目、研究工作台和公开报告统一为中文优先、均衡密度的 Neutral Product Studio，并保持完整英文路由。

**Architecture:** 保留现有 App Router 页面、React 组件和领域状态，只在现有组件边界内调整语义结构、交互状态与文案；全局 token 和公共页排版集中在 `globals.css`，登录、项目、工作台和公开报告继续使用各自 CSS Module。Playwright 提供跨页面视觉审计，Vitest/Testing Library 覆盖移动菜单、表单和状态交互，Cytoscape 图谱的数据、元素和联动契约保持不变。

**Tech Stack:** Next.js 16.2.10 App Router、React 19、TypeScript、next-intl、CSS Modules、lucide-react、Cytoscape、Vitest、Testing Library、Playwright。

---

## 执行前置与文件边界

开始任务 1 前，在 UI worktree 中使用 Node.js `v22.22.1`，安装锁文件中的依赖，并阅读当前版本的 Next.js 文档：

```bash
export PATH=/Users/ailian/.nvm/versions/node/v22.22.1/bin:$PATH
npm install
cat node_modules/next/dist/docs/01-app/01-getting-started/11-css.md
cat node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md
cat node_modules/next/dist/docs/03-architecture/accessibility.md
cat node_modules/next/dist/docs/01-app/02-guides/forms.md
```

预期：`node --version` 为 `v22.22.1`；依赖安装不修改 `package.json` 或 `package-lock.json`；CSS 仍由 locale layout 引入一次，全局规则只放真正跨路由共享的内容，组件规则继续放 CSS Module；不增加字体、UI 或动画依赖。

本里程碑的文件职责固定如下：

- `DESIGN.md`：记录最终 Neutral Product Studio 视觉规则，不保留旧的编辑式衬线方向。
- `src/app/globals.css`：颜色、字体、间距、焦点、公共导航、公共作品集和证据预览。
- `src/components/site/*`：站点级导航、移动菜单、active 状态和页脚语义。
- `src/components/portfolio/*`：首页、作品列表、笔记和真实 Evidence Graph 预览结构。
- `src/app/[locale]/auth/login/login.module.css`：登录页局部布局。
- `src/components/projects/project-workspace.module.css`：项目列表与新建研究表单。
- `src/components/evidence-workspace/evidence-workspace.module.css`：研究工作台完成态与运行状态。
- `src/components/reports/public-report.module.css`：公开报告、公开报告 404 和打印。
- `messages/zh.json`、`messages/en.json`：所有可见界面文案；中文路由不得混入英文分区标签。
- `tests/e2e/support/ui-visual-audit.ts`：统一的可见字号、横向溢出和左侧装饰线审计。

明确不修改：`src/features/**` 的领域模型与 Store、`supabase/**`、RLS、RPC、Inngest、Provider、报告发布状态机和公开报告 DTO。

### Task 1: 全局视觉契约、导航与设计 token

**Files:**
- Create: `tests/e2e/support/ui-visual-audit.ts`
- Modify: `tests/e2e/public-navigation.spec.ts`
- Modify: `tests/e2e/public-visual.spec.ts`
- Modify: `src/components/site/site-header.tsx`
- Modify: `src/components/site/site-footer.tsx`
- Modify: `src/app/[locale]/layout.tsx`
- Modify: `src/app/globals.css`
- Modify: `messages/zh.json`
- Modify: `messages/en.json`
- Modify: `DESIGN.md`

- [ ] **Step 1: 创建统一视觉审计 helper 并编写导航 RED 测试**

创建下面的完整 helper；只有 `.graph-node`、Cytoscape 画布和其隐藏节点导航允许低于 12px：

```ts
import type { Page } from "@playwright/test";

const compactTextSelectors = [
  ".graph-node",
  ".graph-node *",
  "[class*='cytoscapeCanvas']",
  "[class*='nodeNavigator']",
  "[class*='nodeNavigator'] *",
];

export async function inspectVisibleUi(
  page: Page,
  leftRuleSelectors: string[] = [],
) {
  return page.evaluate(
    ({ compactSelectors, ruleSelectors }) => {
      const isVisible = (element: HTMLElement) => {
        const style = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity) > 0 &&
          bounds.width > 0 &&
          bounds.height > 0
        );
      };
      const isCompactGraphText = (element: HTMLElement) =>
        compactSelectors.some((selector) => element.matches(selector));
      const textElements = Array.from(
        document.querySelectorAll<HTMLElement>(
          "a,button,blockquote,code,dd,dt,h1,h2,h3,label,li,p,q,span,strong,time",
        ),
      ).filter(
        (element) =>
          element.textContent?.trim() &&
          isVisible(element) &&
          !isCompactGraphText(element),
      );

      return {
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        fontSizeViolations: textElements
          .filter((element) => Number.parseFloat(getComputedStyle(element).fontSize) < 12)
          .map((element) => element.textContent?.trim().slice(0, 80)),
        leftRuleViolations: ruleSelectors.flatMap((selector) =>
          Array.from(document.querySelectorAll<HTMLElement>(selector))
            .filter(
              (element) => {
                const style = getComputedStyle(element);
                const left = Number.parseFloat(style.borderLeftWidth);
                const otherSides = [
                  Number.parseFloat(style.borderTopWidth),
                  Number.parseFloat(style.borderRightWidth),
                  Number.parseFloat(style.borderBottomWidth),
                ];
                return (
                  isVisible(element) &&
                  left > 0 &&
                  (otherSides.every((width) => width === 0) ||
                    left > Math.max(...otherSides))
                );
              },
            )
            .map((element) => selector),
        ),
      };
    },
    { compactSelectors: compactTextSelectors, ruleSelectors: leftRuleSelectors },
  );
}
```

在 `public-navigation.spec.ts` 增加以下用例：

```ts
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
```

在 `public-visual.spec.ts` 的三档循环内调用 `inspectVisibleUi(page)`，断言 `documentWidth <= viewportWidth`、`fontSizeViolations` 为空，并把首页下一段要求收紧为：

```ts
expect(metrics.selectedWorkTop).toBeLessThan(metrics.viewportHeight);
expect(audit.documentWidth).toBeLessThanOrEqual(audit.viewportWidth);
expect(audit.fontSizeViolations).toEqual([]);
```

- [ ] **Step 2: 运行导航与视觉测试确认 RED**

Run:

```bash
npx playwright test tests/e2e/public-navigation.spec.ts tests/e2e/public-visual.spec.ts
```

Expected: FAIL；当前没有“打开菜单”和 skip link，`作品`没有 `aria-current`，首页仍存在 10–11px 可见文字，首页下一段在至少一个视口没有进入首屏。

- [ ] **Step 3: 实现导航语义、统一 token 和焦点系统**

`SiteHeader` 使用现有 `usePathname` 判断 active 路由，使用 `Menu`/`X` 图标和本地 state 控制移动菜单。核心状态必须与下面一致：

```tsx
const navigationItems = [
  { href: "/" as const, label: t("home") },
  { href: "/work" as const, label: t("work") },
  { href: "/notes" as const, label: t("notes") },
  { href: "/evidence" as const, label: t("evidence") },
];
const [menuOpen, setMenuOpen] = useState(false);
const menuButtonRef = useRef<HTMLButtonElement>(null);
const isCurrent = (href: (typeof navigationItems)[number]["href"]) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

useEffect(() => setMenuOpen(false), [pathname]);
useEffect(() => {
  if (!menuOpen) return;
  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      setMenuOpen(false);
      requestAnimationFrame(() => menuButtonRef.current?.focus());
    }
  };
  window.addEventListener("keydown", closeOnEscape);
  return () => window.removeEventListener("keydown", closeOnEscape);
}, [menuOpen]);
```

导航链接使用 `aria-current={isCurrent(item.href) ? "page" : undefined}`；菜单按钮使用 `aria-expanded`、`aria-controls="primary-navigation"`、中文“打开菜单/关闭菜单”和对应英文键。桌面保留完整导航；`max-width: 680px` 时只显示品牌、语言与 40×40 菜单按钮，菜单作为 header 下方的全宽导航面，不使用浮动卡片。

`LocaleLayout` 在 `.site-shell` 前加入 `<a className="skip-link" href="#main-content">`，`main` 改为 `<main id="main-content" tabIndex={-1}>`。页脚补充语言入口，但不复制一套主导航。

将根 token 改为设计规格中的值：

```css
:root {
  --paper: #f6f7f4;
  --paper-strong: #ffffff;
  --paper-muted: #eef1ee;
  --ink: #18201c;
  --ink-soft: #38413c;
  --muted: #66706a;
  --line: #d8ded9;
  --line-strong: #b9c2bc;
  --vermilion: #b74c40;
  --vermilion-dark: #953c33;
  --teal: #286458;
  --teal-dark: #1f4f46;
  --amber: #a9792a;
  --canvas: #111713;
  --header-height: 68px;
  --content-width: 1200px;
  --page-gutter: 32px;
  --radius: 4px;
  --font-ui: "PingFang SC", "Microsoft YaHei", ui-sans-serif, system-ui,
    -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-display: var(--font-ui);
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
```

全局规则还必须满足：正文 14–16px、辅助信息至少 12px、`font-variant-numeric: tabular-nums` 用于 `time/dt/dd/code` 和指标、圆角不超过 6px、触控目标至少 40px、`:focus-visible` 使用主操作绿且不移除 outline、所有 transition 只列具体属性、reduced motion 关闭非必要动画。

同步重写 `DESIGN.md` 的 Visual thesis、Typography、Density、Components 和 Accessibility，使其与正式规格一致，不再描述编辑式衬线、朱红主操作或深色全屏 hero。

- [ ] **Step 4: 运行聚焦测试确认 GREEN**

Run:

```bash
npx playwright test tests/e2e/public-navigation.spec.ts tests/e2e/public-visual.spec.ts
npm run lint
npm run typecheck
```

Expected: PASS；移动菜单可用 Escape 关闭并归还焦点，active route 正确，skip link 生效，三档首页无小于 12px 的非图谱文字且无横向溢出。

- [ ] **Step 5: Commit**

```bash
git add DESIGN.md messages/zh.json messages/en.json src/app/[locale]/layout.tsx src/app/globals.css src/components/site/site-header.tsx src/components/site/site-footer.tsx tests/e2e/support/ui-visual-audit.ts tests/e2e/public-navigation.spec.ts tests/e2e/public-visual.spec.ts
git commit -m "feat(ui): 统一全站设计系统与导航"
```

### Task 2: 首页、作品、案例与工程笔记

**Files:**
- Modify: `src/components/portfolio/evidence-hero.tsx`
- Modify: `src/components/portfolio/selected-work.tsx`
- Modify: `src/components/portfolio/project-rows.tsx`
- Modify: `src/components/portfolio/practice-notes.tsx`
- Modify: `src/components/portfolio/note-rows.tsx`
- Modify: `src/components/portfolio/profile-band.tsx`
- Modify: `src/app/[locale]/work/page.tsx`
- Modify: `src/app/[locale]/work/[slug]/page.tsx`
- Modify: `src/app/[locale]/notes/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `messages/zh.json`
- Modify: `messages/en.json`
- Modify: `tests/e2e/public-routes.spec.ts`
- Modify: `tests/e2e/public-visual.spec.ts`

- [ ] **Step 1: 编写公共页面中文、层级和布局 RED 测试**

在 `public-routes.spec.ts` 增加：

```ts
test("Chinese portfolio sections do not expose English structural labels", async ({ page }) => {
  const routes = ["/zh", "/zh/work", "/zh/notes", "/zh/work/evidence-graph"];
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator("body")).not.toContainText(/01 \/ Work|02 \/ Notes|Case study|Problem|Approach|Proof/);
  }
});

test("work, notes, and case pages keep balanced-density rows", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const route of ["/zh/work", "/zh/notes", "/zh/work/evidence-graph"]) {
    await page.goto(route);
    const audit = await inspectVisibleUi(page, [".project-proof"]);
    expect(audit.documentWidth).toBeLessThanOrEqual(audit.viewportWidth);
    expect(audit.fontSizeViolations).toEqual([]);
    expect(audit.leftRuleViolations).toEqual([]);
  }
});

test("Evidence Graph case study shows the real graph and public report entry", async ({
  page,
}) => {
  await page.goto("/zh/work/evidence-graph");
  await expect(page.locator(".evidence-canvas-workspace")).toBeVisible();
  await expect(page.getByRole("link", { name: "查看公开报告" })).toHaveAttribute(
    "href",
    "/r/traceable-citations-review-zh",
  );
});
```

在首页三档用例增加 `.portfolio-hero` 背景不能等于 `rgb(17, 23, 19)`，并断言 `.evidence-canvas-hero` 仍有非透明深色背景，确保页面框架变浅但真实图谱仍清晰。

- [ ] **Step 2: 运行公共路由测试确认 RED**

Run:

```bash
npx playwright test tests/e2e/public-routes.spec.ts tests/e2e/public-visual.spec.ts
```

Expected: FAIL；中文页仍显示 `Work/Notes/Case study/Problem/Approach/Proof`，`.project-proof` 仍使用左侧色线，首页仍是全屏深色 hero，案例页还没有真实图谱和公开报告入口。

- [ ] **Step 3: 实现公共页面均衡密度布局**

为 `Portfolio` 增加中英文一一对应键：

```json
{
  "sections": {
    "work": "01 / 作品",
    "notes": "02 / 笔记",
    "about": "03 / 关于",
    "caseStudy": "案例 / {status}",
    "problem": "01 / 问题",
    "approach": "02 / 方法",
    "proof": "03 / 当前结果"
  }
}
```

英文文件使用 `Work/Notes/About/Case study/Problem/Approach/Current proof`。所有公共组件从 translation key 读取分区文案；技术名、项目名和 `Evidence Graph` 保持原文。

首页结构保持 `Ailian` 为唯一品牌 H1，把 Evidence Canvas 放在浅色产品框架中的右侧/下方真实产品区域；桌面首屏使用稳定双列，移动端先显示中文品牌与操作，再露出图谱和 `#selected-work` 顶部。使用固定字号：品牌 H1 桌面 56px、移动 42px；公共页 H1 桌面 44px、移动 34px；区块标题桌面 32px、移动 28px。

公共页 CSS 使用以下密度边界：

```css
.portfolio-section { padding: 64px 0; }
.section-heading { margin-bottom: 32px; }
.project-row { min-height: 0; padding: 28px 0; }
.note-row { min-height: 0; padding: 24px 0; }
.page-intro,
.case-hero { padding-top: 56px; padding-bottom: 48px; }
.project-main .project-proof {
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-left-width: 1px;
  background: var(--paper-muted);
}
```

作品列表保持结构化行：项目名和摘要为主，状态、技术和图标命令为次；不新增卡片容器。案例页的三段内容改为顶部规则和分栏，不在分栏之间使用左侧装饰线。Evidence Graph 案例复用 `EvidenceCanvas locale={locale} mode="workspace"` 显示真实交互图谱，并使用现有 `publicReportSlugs[locale]` 生成“查看公开报告/View public report”入口；不复制 fixture slug、不新增未经验证的数据。笔记行保持序号、状态、标题、摘要和日期基线对齐，移动端日期仍可见并自然换行。

- [ ] **Step 4: 验证公共页面 GREEN 与三档截图**

Run:

```bash
npx playwright test tests/e2e/public-routes.spec.ts tests/e2e/public-visual.spec.ts
```

Expected: PASS；生成 `output/playwright/portfolio-{mobile,tablet,desktop}.png` 与路由截图；中文无英文结构标签，英文路由仍完整，无小字号、横向溢出、左侧装饰线或首屏异常空白。

- [ ] **Step 5: Commit**

```bash
git add messages/zh.json messages/en.json src/app/globals.css src/app/[locale]/work/page.tsx src/app/[locale]/work/[slug]/page.tsx src/app/[locale]/notes/page.tsx src/components/portfolio tests/e2e/public-routes.spec.ts tests/e2e/public-visual.spec.ts
git commit -m "feat(portfolio): 优化公共作品集页面"
```

### Task 3: 证据预览与登录页

**Files:**
- Modify: `src/app/[locale]/evidence/page.tsx`
- Modify: `src/components/portfolio/evidence-canvas.tsx`
- Modify: `src/app/[locale]/auth/login/page.tsx`
- Modify: `src/app/[locale]/auth/login/login.module.css`
- Modify: `src/app/globals.css`
- Modify: `messages/zh.json`
- Modify: `messages/en.json`
- Modify: `tests/e2e/public-routes.spec.ts`
- Modify: `tests/e2e/auth-boundary.spec.ts`
- Modify: `tests/e2e/public-visual.spec.ts`

- [ ] **Step 1: 编写证据预览和登录状态 RED 测试**

在 `auth-boundary.spec.ts` 增加：

```ts
test("login states remain localized, accessible, and stable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/zh/auth/login?error=oauth");

  await expect(page.getByRole("heading", { name: "登录 Evidence Graph" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("托管登录尚未配置");
  await expect(page.getByRole("alert")).toHaveText("登录没有完成，请重新尝试。");
  const audit = await inspectVisibleUi(page);
  expect(audit.documentWidth).toBeLessThanOrEqual(audit.viewportWidth);
  expect(audit.fontSizeViolations).toEqual([]);
  await page.screenshot({ path: "output/playwright/login-mobile.png", fullPage: true });
});
```

在 `public-routes.spec.ts` 的证据预览测试增加所有 `.graph-node` 的 40×40 最小触控边界、`.canvas-inspector` 不与节点相交，以及中文页面不显示 `Product preview`。

- [ ] **Step 2: 运行证据与认证测试确认 RED**

Run:

```bash
npx playwright test tests/e2e/public-routes.spec.ts tests/e2e/auth-boundary.spec.ts
```

Expected: FAIL；登录状态还没有 `role="status"/role="alert"`，证据预览仍显示英文分区标签，移动布局至少有一项新几何断言不满足。

- [ ] **Step 3: 实现连续证据工作区和紧凑登录面板**

`EvidencePage` 使用本地化的“产品预览 / 正在构建”，将说明、主操作、返回和仓库图标收在同一头部层级；外层浅色、画布固定深色，移动端操作自然换行，提示与 inspector 不覆盖节点。`EvidenceCanvas` 不改变 `selectedNode`、hover/focus 同步和节点数据，只提升非节点文字到至少 12px，并确保节点按钮最小 40×40。

登录页保留一个主要 GitHub 动作，使用以下语义：

```tsx
{!configured ? (
  <p className={styles.status} role="status">
    {t("unconfigured")}
  </p>
) : null}
{error ? (
  <p className={styles.error} role="alert">
    {t("error")}
  </p>
) : null}
```

登录 CSS 去掉 72px 常规外边距与衬线标题，使用 `min-height: calc(100svh - var(--header-height))`、`padding: 48px var(--page-gutter)`、最大宽度 480px、42–44px 主按钮；面板使用顶部规则而非浮动卡片，不添加营销 hero。

- [ ] **Step 4: 验证证据预览、登录与既有交互 GREEN**

Run:

```bash
npx playwright test tests/e2e/public-routes.spec.ts tests/e2e/auth-boundary.spec.ts tests/e2e/public-visual.spec.ts
```

Expected: PASS；证据节点点击/hover/focus 保持同步，登录三态可访问，中文无英文结构文案，390px 无裁切或重叠。

- [ ] **Step 5: Commit**

```bash
git add messages/zh.json messages/en.json src/app/globals.css src/app/[locale]/evidence/page.tsx src/components/portfolio/evidence-canvas.tsx src/app/[locale]/auth/login/page.tsx src/app/[locale]/auth/login/login.module.css tests/e2e/public-routes.spec.ts tests/e2e/auth-boundary.spec.ts tests/e2e/public-visual.spec.ts
git commit -m "feat(ui): 优化证据预览与登录体验"
```

### Task 4: 项目列表与新建研究

**Files:**
- Modify: `src/components/projects/project-dashboard.tsx`
- Modify: `src/components/projects/new-research-form.tsx`
- Modify: `src/components/projects/project-workspace.module.css`
- Modify: `messages/zh.json`
- Modify: `messages/en.json`
- Modify: `tests/unit/project-workspace-ui.test.tsx`
- Modify: `tests/e2e/project-dashboard.spec.ts`

- [ ] **Step 1: 编写项目比较、表单语义和稳定尺寸 RED 测试**

在 `project-workspace-ui.test.tsx` 增加：

```tsx
it("keeps project rows and destructive actions semantically separate", () => {
  renderWithMessages(<ProjectDashboard locale="zh" projects={[project]} />);
  const row = screen.getByRole("listitem");
  expect(within(row).getByRole("link", { name: project.title })).toBeVisible();
  expect(within(row).getByText("进行中")).toHaveAttribute("data-status", "active");
  expect(within(row).getByRole("button", { name: /删除/ })).toHaveAttribute(
    "data-variant",
    "danger",
  );
});

it("declares autocomplete and stable form regions", () => {
  renderWithMessages(<NewResearchForm locale="zh" />);
  expect(screen.getByRole("textbox", { name: "项目标题" })).toHaveAttribute(
    "autocomplete",
    "off",
  );
  expect(screen.getByRole("textbox", { name: "研究问题" })).toHaveAttribute(
    "autocomplete",
    "off",
  );
  expect(screen.getByTestId("research-primary-fields")).toBeVisible();
  expect(screen.getByTestId("research-source-fields")).toBeVisible();
  expect(screen.getByTestId("research-form-actions")).toHaveAttribute("aria-live", "polite");
});
```

保留现有五个 URL、错误码、取消删除测试，不修改 action mock 或领域输入。

- [ ] **Step 2: 运行项目 UI 单测确认 RED**

Run:

```bash
npx vitest run tests/unit/project-workspace-ui.test.tsx
```

Expected: FAIL；危险按钮没有 `data-variant`，非认证字段没有 autocomplete，表单还没有稳定的主字段、来源和 action 区域。

- [ ] **Step 3: 实现结构化项目行和双栏研究表单**

项目行继续使用一个主链接，状态、更新时间与语言使用至少 12px；归档和删除留在尾部命令区，删除按钮标记 `data-variant="danger"` 并保留确认。空状态与 header 共用唯一“新建研究”主动作，不增加空白卡片。

新建研究表单增加稳定区域，不改变字段名、action 或错误码：在当前 title field 之前打开 `div.formColumns > section.formPrimary[data-testid="research-primary-fields"]`，在 language field 之后关闭主栏；紧接着用 `section.formSources[data-testid="research-source-fields"]` 包住当前 `urlFieldset`；在 `formColumns` 后保留错误区，并给现有 `div.formActions` 增加 `data-testid="research-form-actions"` 与 `aria-live="polite"`。这样 title/question/language 属于主栏，完整 URL fieldset 属于来源栏，所有稳定错误仍位于提交区上方。

标题、问题和 URL 输入设置 `autoComplete="off"`；URL 保留 `type="url"` 与 `inputMode="url"`。`formColumns` 桌面为 `minmax(0, 1.35fr) minmax(280px, .65fr)`，720px 以下单列；输入高度 44px、紧凑按钮至少 40px、错误 12px 并靠近字段；pending 文案与稳定错误码不得改变 action 区高度。

项目页顶部常规空白收敛到 48–56px，标题使用 28px 左右而非公共 hero 字号；项目列表在 390px 自然变为两层且无横向滚动。

- [ ] **Step 4: 验证项目 GREEN 与路由保护不回归**

Run:

```bash
npx vitest run tests/unit/project-workspace-ui.test.tsx
npx playwright test tests/e2e/project-dashboard.spec.ts tests/e2e/auth-boundary.spec.ts
```

Expected: PASS；项目交互、五 URL 限制、错误提示、删除确认和认证重定向保持不变。

- [ ] **Step 5: Commit**

```bash
git add messages/zh.json messages/en.json src/components/projects/project-dashboard.tsx src/components/projects/new-research-form.tsx src/components/projects/project-workspace.module.css tests/unit/project-workspace-ui.test.tsx tests/e2e/project-dashboard.spec.ts
git commit -m "feat(projects): 优化项目列表与新建研究"
```

### Task 5: 研究工作台完成态

**Files:**
- Modify: `src/components/evidence-workspace/evidence-workspace.tsx`
- Modify: `src/components/evidence-workspace/workspace-claim-list.tsx`
- Modify: `src/components/evidence-workspace/workspace-graph.tsx`
- Modify: `src/components/evidence-workspace/workspace-report.tsx`
- Modify: `src/components/evidence-workspace/workspace-source-viewer.tsx`
- Modify: `src/components/evidence-workspace/workspace-run-log.tsx`
- Modify: `src/components/evidence-workspace/evidence-workspace.module.css`
- Modify: `messages/zh.json`
- Modify: `messages/en.json`
- Modify: `tests/unit/evidence-workspace-ui.test.tsx`
- Modify: `tests/e2e/evidence-workspace-visual.spec.ts`
- Modify: `tests/e2e/evidence-workspace.spec.ts`

- [ ] **Step 1: 编写工作台密度、中文标签和左侧装饰线 RED**

在 `evidence-workspace-visual.spec.ts` 的三档循环内增加：

```ts
const audit = await inspectVisibleUi(page, [
  "[data-testid='selected-claim']",
  "[data-testid='workspace-source'] blockquote",
  "[data-testid='workspace-report'] q",
  "[data-run-log-entry]",
]);
expect(audit.documentWidth).toBeLessThanOrEqual(audit.viewportWidth);
expect(audit.fontSizeViolations).toEqual([]);
expect(audit.leftRuleViolations).toEqual([]);
```

在 `evidence-workspace.spec.ts` 增加中文标签断言：

```ts
test("Chinese workspace uses localized panel labels", async ({ page }) => {
  await page.goto("/zh/app/research/demo");
  await expect(page.locator("body")).not.toContainText(/Claims|Graph|Source|Run Log/);
  await expect(page.getByText("主张列表", { exact: true })).toBeVisible();
  await expect(page.getByText("证据图谱", { exact: true })).toBeVisible();
});
```

在 `evidence-workspace-ui.test.tsx` 增加图谱/报告 segmented control 的 keyboard Home/End 用例，并断言报告 notice 仍用 `role="status"`、错误仍用 `role="alert"`。

- [ ] **Step 2: 运行工作台测试确认 RED**

Run:

```bash
npx vitest run tests/unit/evidence-workspace-ui.test.tsx
npx playwright test tests/e2e/evidence-workspace.spec.ts tests/e2e/evidence-workspace-visual.spec.ts
```

Expected: FAIL；中文面板仍显示 `Claims/Graph/Source/Run Log`，多个 9–11px 控件和元数据违反字号契约，来源引用、报告引用或运行日志仍存在左侧线。

- [ ] **Step 3: 实现工作台完成态的均衡密度与信息层级**

保持 `EvidenceWorkspaceData`、筛选值、选择 ID、review action、publish/revoke action、citation 回跳和移动四 tabs 完全不变，只调整语义标签和视觉结构：

- 运行摘要：状态、项目标题、问题和五个指标为单一 header；数字使用 `var(--font-mono)` 与 tabular nums，辅助标签至少 12px。
- 主张列表：filter 继续用 `aria-pressed` segmented control；选中态改为 `background + inset box-shadow`，不使用 `border-left`；状态保持图标、文字、颜色三重表达。
- 图谱/报告：mode tabs 高度 40px；关系 checkbox 目标至少 40px；图谱外框尺寸在选择前后固定；Cytoscape 字体改为系统无衬线、节点 10px；不改变 `graphStyles` 的节点/边尺寸、layout、zoom、事件或 canvas 生命周期。
- 报告：版本、状态、发布/撤销、打开和复制按顺序排列；citation 按钮使用四边 1px 边界或浅底，不使用左侧线。
- 来源：blockquote 使用浅色内容面、编号/关系文本和四边边界；定义列表 URL 使用 `overflow-wrap: anywhere`。
- 日志：折叠摘要高度稳定，条目加 `data-run-log-entry`，展开内容不覆盖主工作区。

`messages/zh.json` 的 panel 文案改为：

```json
{
  "panels": {
    "claims": "主张列表",
    "graph": "证据图谱",
    "source": "来源详情",
    "log": "运行日志"
  }
}
```

英文保持 `Claims/Graph/Source/Run log`。CSS 以 12–16px 为主，工具面板间距 8–24px，圆角不超过 6px；桌面仍显示四个稳定面板，移动仍只显示 active tab。

- [ ] **Step 4: 验证工作台 GREEN、canvas 和交互稳定**

Run:

```bash
npx vitest run tests/unit/evidence-workspace-ui.test.tsx tests/unit/evidence-workspace.test.ts
npx playwright test tests/e2e/evidence-workspace.spec.ts tests/e2e/evidence-workspace-visual.spec.ts
```

Expected: PASS；三档截图无溢出/裁切/重叠，非图谱文字至少 12px，指定区域无左侧线，canvas 非空像素和尺寸保持稳定，节点点击、键盘选择、四移动 tabs、报告 citation 回跳、发布/撤销 UI 全部不回归。

- [ ] **Step 5: Commit**

```bash
git add messages/zh.json messages/en.json src/components/evidence-workspace tests/unit/evidence-workspace-ui.test.tsx tests/e2e/evidence-workspace.spec.ts tests/e2e/evidence-workspace-visual.spec.ts
git commit -m "feat(workspace): 优化研究工作台信息层级"
```

### Task 6: queued、running、failed、loading、error 与 not-found

**Files:**
- Modify: `src/components/evidence-workspace/workspace-state.tsx`
- Modify: `src/components/evidence-workspace/managed-workspace-state.tsx`
- Modify: `src/components/evidence-workspace/evidence-workspace.module.css`
- Modify: `src/app/[locale]/app/research/[id]/loading.tsx`
- Modify: `src/app/[locale]/app/research/[id]/error.tsx`
- Modify: `src/app/[locale]/app/research/[id]/not-found.tsx`
- Modify: `messages/zh.json`
- Modify: `messages/en.json`
- Modify: `tests/unit/evidence-workspace-ui.test.tsx`

- [ ] **Step 1: 编写完整状态矩阵 RED 测试**

在 `evidence-workspace-ui.test.tsx` 增加 table test：

```tsx
it.each([
  ["loading", "正在载入研究工作台", false],
  ["failed", "研究工作台载入失败", true],
  ["empty", "还没有可审核的主张", false],
  ["not-found", "没有找到这个研究项目", true],
] as const)("renders the %s state with stable guidance", async (state, title, hasAction) => {
  const user = userEvent.setup();
  const action = vi.fn();
  render(
    <NextIntlClientProvider locale="zh" messages={messages}>
      <WorkspaceState
        state={state}
        onAction={state === "failed" ? action : undefined}
        actionHref={state === "not-found" ? "/evidence" : undefined}
      />
    </NextIntlClientProvider>,
  );

  expect(screen.getByRole("heading", { name: title })).toBeVisible();
  expect(screen.getByTestId("workspace-state")).toHaveAttribute("data-state-shell", "stable");
  expect(screen.queryAllByRole("button").length + screen.queryAllByRole("link").length)
    .toBe(hasAction ? 1 : 0);
  if (state === "failed") {
    await user.click(screen.getByRole("button", { name: "重新载入" }));
    expect(action).toHaveBeenCalledOnce();
  }
});
```

补充 `ManagedWorkspaceState` 断言：queued/running 没有重投按钮；普通失败也没有；只有 `RESEARCH_DISPATCH_FAILED + canRetryDispatch` 显示“重新投递研究”；所有状态都有 `data-state-shell="stable"`。

- [ ] **Step 2: 运行状态单测确认 RED**

Run:

```bash
npx vitest run tests/unit/evidence-workspace-ui.test.tsx
```

Expected: FAIL；当前状态 shell 没有稳定标记，状态文案还没有单独表达数据保留/下一步信息。

- [ ] **Step 3: 实现统一状态骨架**

两个状态组件都使用相同结构：状态图标、22–24px 标题、14px 当前说明、12–13px 数据保留/下一步说明、可选错误码和唯一动作，并添加 `data-state-shell="stable"`。`WorkspaceState` 的 `stateTranslationKeys` 为每种状态增加 `detail`，分别映射 `loadingDetail/errorDetail/emptyDetail/notFoundDetail`；`ManagedWorkspaceState` 明确映射 `queuedDetail/runningDetail/failedDetail`。中英文 messages 同名、同层级；不把 loading 图标动画作为唯一状态表达。

状态 CSS 固定 `min-height: calc(100svh - var(--header-height))`，内部内容最大宽度 560px，使用 `grid-template-rows` 和最小 action slot 避免 queued → running → failed 跳动。仅 `RESEARCH_DISPATCH_FAILED` 渲染重投，重投继续复用原 `runId` 和现有 action；不得改轮询间隔、Store 或错误码。

- [ ] **Step 4: 验证状态 GREEN 与工作台回归**

Run:

```bash
npx vitest run tests/unit/evidence-workspace-ui.test.tsx
npx playwright test tests/e2e/evidence-workspace.spec.ts tests/e2e/evidence-workspace-visual.spec.ts
```

Expected: PASS；完整状态矩阵结构一致，重投权限不扩大，工作台完成态不回归。

- [ ] **Step 5: Commit**

```bash
git add messages/zh.json messages/en.json src/components/evidence-workspace/workspace-state.tsx src/components/evidence-workspace/managed-workspace-state.tsx src/components/evidence-workspace/evidence-workspace.module.css src/app/[locale]/app/research/[id]/loading.tsx src/app/[locale]/app/research/[id]/error.tsx src/app/[locale]/app/research/[id]/not-found.tsx tests/unit/evidence-workspace-ui.test.tsx
git commit -m "feat(workspace): 统一研究运行状态页面"
```

### Task 7: 公开报告、分享、打印与 404

**Files:**
- Modify: `src/components/reports/public-report.tsx`
- Modify: `src/components/reports/public-report.module.css`
- Modify: `src/app/r/[slug]/not-found.tsx`
- Modify: `tests/e2e/public-report-visual.spec.ts`
- Modify: `tests/e2e/report-publishing.spec.ts`

- [ ] **Step 1: 编写阅读宽度、引用、工具和 404 RED 测试**

在 `public-report-visual.spec.ts` 的三档循环内增加：

```ts
const audit = await inspectVisibleUi(page, [
  "[data-public-report-section='true']",
  "[data-public-citations='true'] blockquote",
]);
expect(audit.fontSizeViolations).toEqual([]);
expect(audit.leftRuleViolations).toEqual([]);

const reading = await page.evaluate(() => {
  const paragraph = document.querySelector<HTMLElement>("[data-public-report-section] p");
  return {
    paragraphSize: Number.parseFloat(getComputedStyle(paragraph!).fontSize),
    paragraphWidth: paragraph!.getBoundingClientRect().width,
  };
});
expect(reading.paragraphSize).toBeGreaterThanOrEqual(16);
expect(reading.paragraphWidth).toBeLessThanOrEqual(760);
```

在 `report-publishing.spec.ts` 增加：

```ts
test("unavailable report uses one Chinese branded recovery page", async ({ page }) => {
  await page.goto("/r/missing-report");
  await expect(page.getByRole("heading", { name: "报告不可用" })).toBeVisible();
  await expect(page.getByText("Report unavailable or revoked.")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "返回 Evidence Graph" })).toBeVisible();
});
```

- [ ] **Step 2: 运行公开报告测试确认 RED**

Run:

```bash
npx playwright test tests/e2e/public-report-visual.spec.ts tests/e2e/report-publishing.spec.ts
```

Expected: FAIL；正文当前为 14–15px，intro 元数据与引用低于 12px，元数据和 blockquote 使用左侧线，404 混排中英文且使用内联样式。

- [ ] **Step 3: 实现可读报告与品牌 404**

公开报告 header 保持品牌和两个图标命令；桌面工具位于右侧，移动端位于标题后方的稳定工具行。`aria-label/title`、复制状态和 `window.print()` 不变。

报告 intro 压缩到 48–56px，H1 桌面 42–48px、移动 34px；版本/发布时间改为无左边线的两列定义列表；正文 16px、`line-height: 1.75`、最大宽度 720–760px。Citation 使用编号、浅底和完整四边边界：

```css
.reportSources blockquote {
  max-width: 720px;
  margin: 12px 0;
  padding: 14px 16px;
  overflow-wrap: anywhere;
  border: 1px solid var(--line);
  border-left-width: 1px;
  background: var(--paper-muted);
  font-family: var(--font-ui);
  font-size: 16px;
  line-height: 1.65;
}
```

`not-found.tsx` 改用 `public-report.module.css` 的 `notFound`/`notFoundHeader`/`notFoundBody`，移除全部 inline style 和英文混排，保留 Evidence Graph 品牌、中文解释和返回入口。打印仍隐藏 `.reportTools`，正文与来源保持可见并使用白底，章节避免跨页断裂。

- [ ] **Step 4: 验证报告 GREEN、交互与打印**

Run:

```bash
npx playwright test tests/e2e/public-report-visual.spec.ts tests/e2e/report-publishing.spec.ts
```

Expected: PASS；三档正文可读、引用无左侧装饰线、工具不重叠、中文 404 不混排、英文稳定 slug 仍输出英文报告、打印隐藏工具且保留正文与来源。

- [ ] **Step 5: Commit**

```bash
git add src/components/reports/public-report.tsx src/components/reports/public-report.module.css src/app/r/[slug]/not-found.tsx tests/e2e/public-report-visual.spec.ts tests/e2e/report-publishing.spec.ts
git commit -m "feat(report): 优化公开报告阅读体验"
```

### Task 8: 全路由长文本、键盘与三档视觉门禁

**Files:**
- Modify: `tests/e2e/public-visual.spec.ts`
- Modify: `tests/e2e/public-routes.spec.ts`
- Modify: `tests/e2e/auth-boundary.spec.ts`
- Modify: `tests/e2e/evidence-workspace-visual.spec.ts`
- Modify: `tests/e2e/public-report-visual.spec.ts`
- Modify: `tests/unit/project-workspace-ui.test.tsx`
- Modify: `tests/unit/evidence-workspace-ui.test.tsx`

- [ ] **Step 1: 增加最终长文本和跨路由 RED 契约**

为三档视口建立统一矩阵：

```ts
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
```

每个路由调用 `inspectVisibleUi`，断言无横向溢出和非图谱小字号，保存到 `output/playwright/ui-refresh/{name}-{mobile|tablet|desktop}.png`。在 unit 测试分别使用 120 字项目标题、2000 字问题、超长 URL、空项目数组和长错误消息，断言 DOM 保留全文且可访问名称未丢失。

- [ ] **Step 2: 运行最终聚焦测试确认任何残余 RED**

Run:

```bash
npx vitest run tests/unit/project-workspace-ui.test.tsx tests/unit/evidence-workspace-ui.test.tsx
npx playwright test tests/e2e/public-visual.spec.ts tests/e2e/public-routes.spec.ts tests/e2e/auth-boundary.spec.ts tests/e2e/evidence-workspace-visual.spec.ts tests/e2e/public-report-visual.spec.ts
```

Expected: 如果任一路由仍有小于 12px 的非图谱文字、横向溢出、裁切、重叠、左侧装饰线或长文本问题则 FAIL；只有所有矩阵项满足契约才进入下一步。

- [ ] **Step 3: 做最小 CSS/结构收口**

只修复 Step 2 暴露的具体选择器：使用 `minmax(0, 1fr)`、`overflow-wrap: anywhere`、稳定 `min-height`、40px 触控目标或 12px 辅助字号；不得通过隐藏正文、缩小字体、扩大页面空白或改变领域数据绕过断言。若没有残余失败，此步骤不产生代码改动。

- [ ] **Step 4: 运行完整非付费门禁**

显式清空远端和付费 Provider 变量后运行：

```bash
env -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_ANON_KEY -u SUPABASE_SERVICE_ROLE_KEY -u INNGEST_EVENT_KEY -u INNGEST_SIGNING_KEY -u NEXT_PUBLIC_SENTRY_DSN -u SENTRY_AUTH_TOKEN -u OPENAI_API_KEY -u TAVILY_API_KEY npm run test:managed
```

Expected: Provider 边界、数据库 reset/pgTAP/Schema lint、lint、typecheck、全部 unit、生产 build 和全部 E2E 通过；没有真实 Supabase/Inngest/Sentry/OpenAI/Tavily 请求。逐张查看 390×844、1024×768、1440×1000 截图，并确认图谱 canvas 非空、布局没有跳动。

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/public-visual.spec.ts tests/e2e/public-routes.spec.ts tests/e2e/auth-boundary.spec.ts tests/e2e/evidence-workspace-visual.spec.ts tests/e2e/public-report-visual.spec.ts tests/unit/project-workspace-ui.test.tsx tests/unit/evidence-workspace-ui.test.tsx src/app/globals.css src/app/[locale]/auth/login/login.module.css src/components/projects/project-workspace.module.css src/components/evidence-workspace/evidence-workspace.module.css src/components/reports/public-report.module.css
git commit -m "test(ui): 完成全路由视觉验收"
```

若 Step 3 没有代码变更，只提交实际新增的测试；不要创建空提交。

### Task 9: 状态文档、唯一 Draft PR 与自动闭环

**Files:**
- Modify: `PROJECT_STATUS.md`
- Modify: `docs/development-plan.md`

- [ ] **Step 1: 更新项目状态与门禁证据**

将 UI 里程碑状态更新为“本地实现与完整门禁通过，等待唯一 Draft PR 审核”，记录：

- 三档视口与覆盖路由；
- 字号、横向溢出、左侧装饰线、键盘和长文本门禁；
- canvas 像素与工作台联动结果；
- `npm run test:managed` 的数据库、unit、E2E 实际数量；
- Vercel 生产发布仍是独立后置门禁，不宣称已经上线。

- [ ] **Step 2: 检查差异并提交状态文档**

Run:

```bash
git diff --check
git status -sb
git diff --stat main...HEAD
git log --oneline main..HEAD
```

Expected: 无 whitespace error；只有 UI 规格、计划、实现、测试和状态文档；没有 `.env`、截图产物、密钥、私人来源正文、Provider 响应或依赖变更。

```bash
git add PROJECT_STATUS.md docs/development-plan.md
git commit -m "docs(status): 记录全站 UI 优化门禁"
```

- [ ] **Step 3: 推送并创建唯一 Draft PR**

```bash
git push -u origin feat/ui-experience-refresh
gh pr create --draft --base main --head feat/ui-experience-refresh --title "feat(ui): 全站体验优化" --body-file /tmp/evidence-graph-ui-pr.md
```

`/tmp/evidence-graph-ui-pr.md` 必须用中文包含范围、逐页变化、TDD/视觉证据、完整门禁、无真实 Provider、Vercel 非生产上线说明。不得创建第二个 PR。

- [ ] **Step 4: 执行独立 Claude 审核并闭环**

```bash
claude --permission-mode auto --model sonnet -p "/codex-independent-pr-review <PR编号>"
```

读取 `CLAUDE_REVIEW_RESULT` 与 `CLAUDE_REVIEWED_SHA`。如果为 `changes_requested`，逐条验证 finding，在当前分支按 RED→GREEN 修复，运行聚焦测试与完整 `test:managed`，使用中文 Conventional Commit，push 后重新审核；不新建 PR。

- [ ] **Step 5: 等待 CI 并用 merge commit 合并**

```bash
gh pr checks <PR编号> --watch
gh pr view <PR编号> --json headRefOid,mergeStateStatus,statusCheckRollup
gh pr merge <PR编号> --merge --delete-branch
```

Expected: Claude `pass` 的 `CLAUDE_REVIEWED_SHA` 等于当前 `headRefOid`，所有 GitHub CI 成功，使用 merge commit 合并；禁止 squash、rebase、force push。合并后同步本地 `main`，更新 `PROJECT_STATUS.md` 记录 merge commit，并把 Vercel 账号恢复后的部署工作继续保留为独立发布门禁。

## 规格覆盖自检

- 全局导航、移动菜单、active 状态、skip link、页脚、焦点、触控和 reduced motion：Task 1。
- 中文优先系统无衬线、指定颜色、字号下限、均衡间距、圆角与卡片约束：Task 1–8。
- 首页、作品列表、案例详情、工程笔记：Task 2。
- 证据预览和登录：Task 3。
- 项目列表、空状态、新建研究双栏、autocomplete 和长 URL：Task 4、8。
- 工作台运行摘要、主张、图谱、报告、来源与日志：Task 5。
- queued、running、failed、loading、error、empty、not-found：Task 6。
- 公开报告、分享、打印和品牌 404：Task 7。
- 390×844、1024×768、1440×1000、长文本、键盘、canvas 和完整非付费门禁：Task 8。
- 状态文档、唯一 Draft PR、独立审核、CI 和 merge commit：Task 9。
- 数据库、RLS、Inngest、Provider、领域模型和报告发布契约均不在任何实现步骤中修改。
