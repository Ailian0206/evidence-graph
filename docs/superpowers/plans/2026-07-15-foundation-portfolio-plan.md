# Foundation and Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a locally runnable, bilingual Next.js foundation that presents Ailian, Evidence Graph, and AI Photo Studio CN with a tested CI and visual baseline.

**Architecture:** One Next.js App Router application uses locale-prefixed public routes, typed content modules, shared layout primitives, and a full-bleed evidence-themed hero. Product application routes remain intentionally unavailable until the next module. Vitest verifies content and routing helpers; Playwright verifies public navigation and responsive layout.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, next-intl, Lucide, Vitest, Testing Library, Playwright, GitHub Actions.

---

### Task 1: Scaffold the application

**Files:**
- Create: `package.json`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `eslint.config.mjs`

- [x] Create a Next.js App Router project with TypeScript, Tailwind, ESLint, `src/`, and npm.
- [x] Pin Node 22 in `.nvmrc` and `package.json#engines`.
- [x] Install `next-intl`, `lucide-react`, `zod`, Vitest, Testing Library, jsdom, and Playwright.
- [x] Run `npm run lint`, `npm run typecheck`, and `npm run build`; record the clean scaffold baseline.
- [x] Commit as `chore: 初始化 Evidence Graph 工程`.

### Task 2: Establish tests and CI

**Files:**
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `playwright.config.ts`
- Create: `tests/e2e/public-navigation.spec.ts`
- Create: `.github/workflows/ci.yml`
- Modify: `package.json`

- [x] Add a Playwright test expecting `/zh` to show `Ailian` and navigation to `/zh/work`.
- [x] Run the test and verify RED because locale routes do not exist.
- [x] Add scripts for `lint`, `typecheck`, `test:unit`, `test:e2e`, and `test:ci`.
- [x] Configure CI on pull requests and `main` pushes with read-only contents permission, Node 22, npm cache, Chromium, and the full gate.
- [x] Keep the navigation test RED until Task 4; verify unit infrastructure independently.
- [x] Commit as `ci: 建立项目质量门禁`.

### Task 3: Add locale and typed portfolio content

**Files:**
- Create: `src/i18n/routing.ts`
- Create: `src/i18n/request.ts`
- Create: `src/middleware.ts`
- Create: `src/content/profile.ts`
- Create: `src/content/projects.ts`
- Create: `src/content/notes.ts`
- Create: `tests/unit/content.test.ts`
- Create: `messages/zh.json`
- Create: `messages/en.json`

- [ ] Write unit tests requiring locales `zh` and `en`, Ailian's email, exactly two public projects, and no ProjectPilot entry.
- [ ] Run the focused test and verify RED because content modules do not exist.
- [ ] Implement typed bilingual content and next-intl locale routing.
- [ ] Run the focused test and verify GREEN.
- [ ] Commit as `feat: 增加双语作品集内容模型`.

### Task 4: Build the public portfolio pages

**Files:**
- Create: `src/app/[locale]/layout.tsx`
- Create: `src/app/[locale]/page.tsx`
- Create: `src/app/[locale]/work/page.tsx`
- Create: `src/app/[locale]/work/[slug]/page.tsx`
- Create: `src/app/[locale]/notes/page.tsx`
- Create: `src/app/[locale]/evidence/page.tsx`
- Create: `src/components/site/site-header.tsx`
- Create: `src/components/site/site-footer.tsx`
- Create: `src/components/portfolio/evidence-hero.tsx`
- Create: `src/components/portfolio/selected-work.tsx`
- Create: `src/components/portfolio/practice-notes.tsx`
- Create: `src/components/portfolio/profile-band.tsx`

- [ ] Run the existing public navigation Playwright test and confirm RED with missing pages.
- [ ] Implement the locale layout, public pages, accessible navigation, language switcher, and mail/GitHub links.
- [ ] Use a full-bleed hero whose primary visual is a functional sample evidence graph built from semantic HTML/CSS, not a decorative SVG.
- [ ] Present Evidence Graph first and AI Photo Studio CN second; use honest `Building` and `In development` states.
- [ ] Run the navigation test and verify GREEN.
- [ ] Commit as `feat: 实现双语个人作品集页面`.

### Task 5: Create the responsive visual system

**Files:**
- Modify: `src/app/globals.css`
- Create: `tests/e2e/public-visual.spec.ts`

- [ ] Add Playwright assertions for no horizontal overflow at 390, 1024, and 1440 widths; verify RED before responsive styles are complete.
- [ ] Implement stable header, hero, graph, project rows, notes, footer, focus, reduced-motion, and mobile styles.
- [ ] Use zero letter-spacing, fixed control dimensions, radius no larger than 6px, and no nested cards or purple/blue gradient theme.
- [ ] Verify text wrapping with the longest Chinese/English labels and preserve a visible hint of Selected Work below the hero.
- [ ] Run the visual test and verify GREEN.
- [ ] Commit as `style: 完成作品集响应式视觉基线`.

### Task 6: Document and close the module

**Files:**
- Modify: `README.md`
- Modify: `PROJECT_STATUS.md`
- Modify: `docs/development-plan.md`

- [ ] Start the local server and verify `/zh`, `/en`, `/zh/work`, and `/zh/evidence` with browser screenshots.
- [ ] Run `npm run test:ci` and require a clean exit.
- [ ] Run `git diff --check`, secret scan, and placeholder scan.
- [ ] Update status with the branch, verification output, and next module.
- [ ] Commit as `docs: 记录作品集基础模块结果`.
- [ ] Push `feat/foundation-portfolio` and create a Draft PR with summary, verification, screenshots, risk, and follow-up sections.
