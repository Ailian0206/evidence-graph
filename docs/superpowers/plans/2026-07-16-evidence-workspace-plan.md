# 证据工作台实施计划

**目标：** 用确定性 Fixture 建成可交互的研究工作台，完成 Claim 审核、证据图谱、来源查看、运行日志和响应式交互，不调用真实 Provider。

**架构：** 动态路由页面作为 Server Component 读取本地工作台 Fixture，再把可序列化视图模型传给交互式 Client Component。领域选择器、审核状态更新和图谱元素生成保持为纯函数；Cytoscape.js 只负责图谱布局与交互，Claim、Evidence 和 Source 仍以现有领域实体为唯一数据来源。

**技术栈：** Next.js 16 App Router、React 19、TypeScript、next-intl、Cytoscape.js、CSS Modules、Vitest、Testing Library、Playwright。

---

## 交付边界

- 桌面端固定三栏：Claim 列表、图谱、来源查看器。
- 移动端四个标签：Claims、Graph、Source、Log。
- Claim 支持 `pending`、`accepted`、`rejected` 三种人工审核状态。
- 支持 `supports`、`rebuts`、`qualifies`、`context` 多选筛选。
- 点击 Claim、Evidence 或 Source 节点会同步定位 Claim、证据和原文。
- Run Log 可展开和收起，展示步骤、状态、Token、搜索量和估算成本。
- 提供加载、失败、空数据和未知项目状态。
- 不实现登录、数据库写入、报告发布和真实 Provider 调用，这些属于后续模块。

## 任务 1：工作台视图模型与 Fixture

**文件：**

- 新建 `src/features/research/evidence-workspace.ts`
- 新建 `src/features/research/evidence-workspace-fixture.ts`
- 新建 `tests/unit/evidence-workspace.test.ts`

1. 先为 Claim 状态筛选、关系统计、审核状态不可变更新和图谱元素生成写失败测试。
2. 运行 `npm run test:unit -- tests/unit/evidence-workspace.test.ts`，确认测试因实现缺失而失败。
3. 实现最小纯函数和包含四类证据关系的双语 Fixture。
4. 生成 200 个 Claim 的测试数据，验证图谱模型节点和边数量稳定、标签长度不影响元素结构。
5. 聚焦测试通过后提交：`feat(workspace): 建立证据工作台视图模型`。

## 任务 2：动态路由、双语和页面状态

**文件：**

- 新建 `src/app/[locale]/app/research/[id]/page.tsx`
- 新建 `src/app/[locale]/app/research/[id]/loading.tsx`
- 新建 `src/app/[locale]/app/research/[id]/error.tsx`
- 新建 `src/app/[locale]/app/research/[id]/not-found.tsx`
- 修改 `src/app/[locale]/evidence/page.tsx`
- 修改 `messages/zh.json`
- 修改 `messages/en.json`
- 修改 `tests/e2e/public-routes.spec.ts`

1. 先增加 `/zh/app/research/demo`、`/en/app/research/demo` 和未知项目 404 的失败路由测试。
2. Server Component 解析异步 `params`，只加载确定性 Fixture；未知 ID 调用 `notFound()`。
3. `/evidence` 增加“打开示例工作台”入口，所有工作台文案提供中英文。
4. 实现路由级加载、异常恢复和未找到状态。
5. 聚焦 E2E 通过后提交：`feat(workspace): 增加双语工作台路由`。

## 任务 3：桌面工作台与 Claim 审核

**文件：**

- 新建 `src/components/evidence-workspace/evidence-workspace.tsx`
- 新建 `src/components/evidence-workspace/workspace-claim-list.tsx`
- 新建 `src/components/evidence-workspace/evidence-workspace.module.css`
- 新建 `tests/unit/evidence-workspace-ui.test.tsx`

1. 先写筛选 Claim、选择 Claim、接受和拒绝 Claim 的失败组件测试。
2. 实现项目栏、三栏骨架、状态筛选和 Claim 列表；审核动作只更新人工状态，不覆盖模型 Statement。
3. 使用固定网格轨道、最小宽度和溢出约束，保证最长标题不改变整体布局。
4. 聚焦组件测试通过后提交：`feat(workspace): 实现主张筛选与审核`。

## 任务 4：Cytoscape 图谱与来源联动

**文件：**

- 修改 `package.json`
- 修改 `package-lock.json`
- 新建 `src/components/evidence-workspace/workspace-graph.tsx`
- 新建 `src/components/evidence-workspace/workspace-source-viewer.tsx`
- 修改 `src/components/evidence-workspace/evidence-workspace.tsx`
- 修改 `src/components/evidence-workspace/evidence-workspace.module.css`
- 新建 `tests/e2e/evidence-workspace.spec.ts`

1. 安装 `cytoscape` 和所需 TypeScript 类型，不手写图布局引擎。
2. 先写节点点击后 Claim 和 Source 同步更新、关系筛选隐藏对应边的失败 E2E。
3. 实现 Claim、Evidence、Source 三类节点和关系边；容器支持方向键循环选择节点，Enter 确认。
4. 来源查看器展示 URL、作者、日期、来源类型、Relation、Strength、精确 Quote 和原网页入口。
5. 聚焦单元与 E2E 通过后提交：`feat(workspace): 联动证据图谱与来源查看`。

## 任务 5：移动端标签与 Run Log

**文件：**

- 新建 `src/components/evidence-workspace/workspace-run-log.tsx`
- 修改 `src/components/evidence-workspace/evidence-workspace.tsx`
- 修改 `src/components/evidence-workspace/evidence-workspace.module.css`
- 修改 `tests/e2e/evidence-workspace.spec.ts`

1. 先写 390px 下四标签切换、键盘激活标签和 Run Log 收起/展开的失败 E2E。
2. 桌面保留三栏和底部日志；移动端一次只展示当前标签面板，不横向压缩三栏。
3. Run Log 展示步骤结果和运行指标，失败条目保持可读错误信息。
4. 聚焦 E2E 通过后提交：`feat(workspace): 完成移动标签与运行日志`。

## 任务 6：空状态、失败状态与视觉门禁

**文件：**

- 新建 `src/components/evidence-workspace/workspace-state.tsx`
- 修改 `src/components/evidence-workspace/evidence-workspace.tsx`
- 修改 `src/components/evidence-workspace/evidence-workspace.module.css`
- 新建 `tests/e2e/evidence-workspace-visual.spec.ts`

1. 先写加载、失败、空 Claim 状态的组件测试。
2. 实现明确的状态标题、恢复操作和不会改变工作台外框尺寸的占位布局。
3. 在 390x844、1024x768、1440x1000 三种视口检查横向溢出、文字裁切、面板重叠和图谱空白。
4. 保存 Playwright 截图到 `output/playwright/`，该目录保持不提交。
5. 提交：`test(workspace): 覆盖响应式工作台状态`。

## 任务 7：里程碑验证与状态更新

**文件：**

- 修改 `PROJECT_STATUS.md`
- 修改 `docs/development-plan.md`

1. 运行 `git diff --check`、`npm run lint`、`npm run typecheck`、`npm run test:unit`、`npm run build` 和工作台 E2E。
2. 运行完整 `npm run test:ci`，确认 Provider 安全扫描和既有公开页面没有回归。
3. 更新项目状态，记录测试数量、三视口截图和当前分支状态。
4. 提交：`docs(status): 记录证据工作台里程碑`。
5. 只有以上全部完成后，推送分支并创建本模块唯一 Draft PR。

## 完成标准

- 中英文示例工作台均可直接打开并操作。
- Claim 筛选、接受、拒绝、图谱节点选择、来源定位和日志切换均有自动化测试。
- 200 个 Claim 的图谱模型生成测试通过。
- 三种规定视口无横向溢出、裁切、重叠和空白画布。
- lint、typecheck、unit、build、E2E 和完整 CI 门禁全部通过。
- 开发期间不创建中间 PR；里程碑完成后只创建一个 Draft PR。
