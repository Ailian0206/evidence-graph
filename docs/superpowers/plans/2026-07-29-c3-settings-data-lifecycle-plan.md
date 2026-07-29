# C3 Settings 与账号数据生命周期实施计划

## 目标与边界

交付语言偏好、项目删除闭环和测试账号删除。只修改 C3 所需的 Settings、Auth/Project 生命周期、双语文案和验证；不调用 Provider、不操作 Production、不开始 C4。

## Task 1：Profile 偏好与账号生命周期

**文件**

- 新增 `src/features/settings/account-settings.ts`
- 新增 `src/features/settings/actions.ts`
- 新增 `tests/unit/account-settings.test.ts`
- 新增 `tests/unit/account-settings-actions.test.ts`

**TDD**

1. 先测试非法语言、跨用户空结果、确认文本不匹配、Admin 删除失败和成功编排。
2. 运行上述测试确认 RED。
3. 实现最小 Profile 查询/更新、cookie 同步、当前会话确认和 Admin hard delete。
4. 运行上述测试确认 GREEN。

## Task 2：Settings 页面和工作台入口

**文件**

- 新增 `src/app/[locale]/app/settings/page.tsx`
- 新增 `src/components/settings/account-settings.tsx`
- 新增 `src/components/settings/account-settings.module.css`
- 修改 `src/components/projects/managed-app-shell.tsx`
- 修改 `messages/zh.json`、`messages/en.json`
- 新增 `tests/unit/account-settings-ui.test.tsx`
- 新增 `tests/unit/managed-settings-page.test.tsx`
- 修改 `tests/unit/managed-app-shell.test.tsx`

**TDD**

1. 先测试 Settings 导航、账号摘要、语言表单、确认门禁、pending/error 状态和双语文案并确认 RED。
2. 实现页面、安静的表单布局和危险区，沿用现有应用外壳。
3. 运行 Settings/UI 聚焦测试确认 GREEN，并执行 focused lint/typecheck。

## Task 3：数据库级联与访问边界

**文件**

- 新增 `supabase/tests/05_account_lifecycle.sql`
- 修改 `tests/e2e/auth-boundary.spec.ts`

**TDD**

1. pgTAP 先断言项目删除清理全部依赖和公开 slug，账号删除清理 Profile、Project、Usage 及全部研究数据，跨用户删除无效。
2. 增加匿名 Settings 跳转测试。
3. 运行托管 pgTAP 和聚焦 E2E；仅在测试证明现有 Schema 不足时新增迁移。

## Task 4：验收与交付

1. 运行 `git diff --check`、lint、typecheck、unit、build、E2E、`test:managed`。
2. 在托管开发环境创建专用测试项目和测试账号，验证语言保持、项目删除、公开 slug 失效、账号删除和旧会话失效。
3. 检查 390x844、1024x768、1440x1000，无溢出、裁切和控件重叠。
4. 更新 `PROJECT_STATUS.md`，提交并创建唯一 Draft PR。
5. 立即运行独立 Claude 审核；当前 head 审核通过且 CI 全绿后 merge commit 合并。
