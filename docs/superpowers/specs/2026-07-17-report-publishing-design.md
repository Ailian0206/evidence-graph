# 报告发布设计

> 日期：2026-07-17
> 分支：`feat/report-publishing`
> 状态：已确定，可直接实施

## 1. 目标

把研究工作流已经持久化的报告草稿变成可管理、可撤销、可切换版本并可匿名分享的只读报告，同时保持以下产品约束：

1. 同一个项目始终使用同一个 `/r/[slug]` 分享地址。
2. 匿名访问者只能读取当前已发布版本，不能直接读取项目、来源正文或其他报告版本。
3. 发布、版本切换、撤销、项目可见性和审计事件必须在同一个数据库事务中完成。
4. 每个事实型报告章节必须至少包含一个可解析到引用快照的 Citation。
5. 公开报告按研究语言固化为单语言快照，不根据访问者语言切换内容。

## 2. 范围

本模块完成：

- 报告版本列表和当前版本选择。
- 发布草稿或已撤销版本。
- 将当前公开版本切换到另一个历史版本。
- 撤销当前公开版本。
- 稳定公开 slug 和 `/r/[slug]` 匿名路由。
- 公开报告的标题、问题、结构化正文、引用快照和来源链接。
- 分享链接复制、SEO metadata 和打印样式。
- 中文和英文工作台文案；公开报告正文保持报告原始语言。
- 确定性公开示例，不调用真实 Provider。

本模块不完成：

- 报告正文编辑器或 Markdown 任意编辑。
- 重新调用 LLM 生成报告。
- 报告翻译、PDF 导出、评论、协作和访问密码。
- 自定义公开 slug。
- 对已发布快照做原地修改。

## 3. 核心决策

### 3.1 稳定分享地址

`projects.slug` 是项目的稳定公开标识。数据库继续把同一个值临时分配给当前 `published` 报告的 `reports.slug`，但任意时刻只有一个版本可以持有该 slug：

- 首次发布：目标报告变为 `published`，获得项目 slug。
- 版本切换：旧版本变为 `revoked` 且清空 slug，新版本变为 `published` 并接管同一个 slug。
- 撤销：当前版本变为 `revoked` 且清空 slug，项目恢复 `private`。

这样保留现有表结构和 `get_public_report(slug)` 边界，同时不会让分享链接随版本变化。

### 3.2 原子数据库函数

新增两个 authenticated RPC：

- `publish_report_version(requested_project_id, requested_report_id)`
- `revoke_published_report(requested_project_id)`

函数从 `auth.uid()` 推导当前用户，不接受客户端传入 owner。发布函数锁定项目和目标报告，验证所属关系、项目状态、报告结构与 Citation 完整性，撤销同项目旧版本，再发布目标版本并写入审计事件。撤销函数锁定项目和当前版本，完成撤销、项目私有化和审计写入。

重复发布已经公开的同一版本属于幂等成功，不重复写审计事件。撤销没有公开版本的项目也属于幂等成功。

### 3.3 发布完整性

工作流已经在写入前用 Zod 和精确引用关系验证报告。发布 RPC 仍需防御用户通过 Data API 直接修改自己可写的报告行，最低验证：

- `sections` 和 `citations` 都是非空数组。
- 每个事实型章节的 `citationIds` 是非空数组。
- 每个章节引用 ID 都能在报告 `citations[].evidenceLinkId` 中找到。
- Citation 必须包含 claim、chunk、source、quote、sourceUrl 和 sourceTitle 快照字段。

不在发布时重新读取或覆盖来源正文，公开页只展示报告生成时保存的 Citation 快照。

### 3.4 版本模型

`reports(project_id, version)` 继续保持唯一。工作台按 version 降序读取全部报告，用户可以预览任意版本，但只有当前 `published` 版本拥有公开地址。

本模块不创建新版本。新版本仍由后续研究运行写入；当前模块只保证已有版本的选择和公开状态切换完整可用。

### 3.5 公开读取

匿名用户仍不能直接查询 `projects`、`reports`、`sources` 或 `source_chunks`。`get_public_report(slug)` 是唯一公开数据入口，并补充返回：

- 报告语言。
- 当前报告状态所需的公开字段。

函数只返回 active、public 项目的当前 published 报告。撤销后同一个 slug 返回空结果，Next.js 路由调用 `notFound()`。

## 4. 应用结构

### 4.1 报告领域与 Store

新增 `src/features/reports/report-store.ts`：

- 定义报告发布状态、数据库行和公开报告 Schema。
- 映射报告 JSON 到现有 `reportSectionSchema`、`reportCitationSchema`。
- 提供 owner 版本列表查询、发布 RPC、撤销 RPC和公开报告 RPC 适配器。
- 对 Supabase 错误统一抛出稳定错误码，不向客户端返回原始数据库对象。

`ManagedWorkspaceStore` 增加 `listReports(projectId)`，ready 状态同时返回版本列表。queued、running 和 failed 状态继续不读取报告或其他部分结果。

### 4.2 Server Actions

新增 `src/features/reports/actions.ts`：

- `publishReport(locale, projectId, reportId)`
- `revokeReport(locale, projectId)`

每个入口都重新获取当前用户、用 Zod 校验 ID 和 locale，再调用 Store。成功后 revalidate 当前工作台与公开 slug；不信任客户端提供的 slug、状态、正文或 owner。

### 4.3 工作台

现有三栏结构保持不变。中栏增加 `图谱 / 报告` 分段控制：

- 图谱模式保留现有 Cytoscape 交互和稳定尺寸。
- 报告模式显示版本选择、发布状态、章节正文和 Citation 列表。
- 选择 Citation 会同步到现有 Claim 和 Source 面板，继续保持从报告回到证据原文的路径。
- 管理型工作台显示发布、切换版本、撤销和复制链接操作。
- Demo 工作台只展示已发布示例和公开链接，不执行数据库写入。

移动端继续保留 `Claims / Graph / Source / Log` 四个一级 Tab；Graph 面板内部使用 `图谱 / 报告` 分段控制，避免增加第五个一级 Tab 和破坏既有键盘导航。

### 4.4 公开报告页

新增独立 root layout：

- `src/app/r/[slug]/layout.tsx`
- `src/app/r/[slug]/page.tsx`

该路由不挂 locale 前缀。`src/proxy.ts` 对 `/r/` 直接放行，避免 next-intl 重定向到 `/zh/r/...`。

页面使用结构化 sections 渲染，不执行任意 HTML，不引入 Markdown HTML 解析器。Citation marker 解析为页内链接，引用区展示来源标题、精确 quote、原始 URL 和打开来源操作。

SEO metadata 使用报告标题、问题、canonical `/r/[slug]` 和 Open Graph article 信息。打印样式隐藏分享工具，保持正文和引用完整。

### 4.5 确定性公开示例

新增中文和英文公开报告 fixtures。固定 slug 分别为：

- `traceable-citations-review-zh`
- `traceable-citations-review-en`

构建、E2E 和日常测试不需要 Supabase 或真实 Provider。其他 slug 只有在 Supabase 公共环境已配置时才调用公开 RPC。

## 5. 错误处理

- 非所属项目或报告统一映射为 `REPORT_NOT_FOUND`，不泄露其他用户是否存在该 ID。
- 引用结构不完整返回 `REPORT_NOT_PUBLISHABLE`。
- 归档或删除项目返回 `PROJECT_NOT_PUBLISHABLE`。
- Server Action 失败时工作台保留原状态并显示可重试错误，不做错误的乐观发布。
- 公开报告不存在、项目私有、已撤销或托管环境未配置时返回 404。
- 复制剪贴板失败时保留可选中文本链接并显示失败状态。

## 6. 安全与隐私

- API Key、Supabase 凭据和私人来源正文不进入仓库。
- 公开 RPC 只返回报告中的 Citation 快照，不返回完整 source body、成本、owner 或 run 日志。
- Server Actions 重新认证并从 session 推导 owner。
- 数据库函数固定空 `search_path`，撤销 public/anon 执行权限，只向 authenticated 和 service_role 授权写 RPC。
- 公开读取函数继续只向 anon、authenticated 和 service_role 授权。
- Sentry 现有脱敏规则继续覆盖 report、quote 和 Provider payload。

## 7. 验证

数据库：

- 跨用户不能发布或撤销。
- 首次发布、版本切换、重复发布、撤销和审计事件正确。
- 同项目最多一个 published 版本。
- 非完整 Citation 报告不能发布。
- 匿名用户只能读取当前公开快照，撤销后立即不可读。

单元测试：

- Store 映射版本、公开报告和 Supabase RPC。
- Actions 验证认证、参数、revalidate 和错误回滚。
- 工作台报告视图、版本切换、Citation 联动和分享状态。
- Demo fixtures 不依赖真实服务。

E2E：

- `/r/[slug]` 不被 locale 重定向。
- 中英文公开示例可打开，未知或撤销 slug 返回 404。
- 报告 Citation 可打开来源并保持只读。
- 工作台在 390x844、1024x768 和 1440x1000 下切换图谱/报告不溢出、不重叠、不改变固定栏宽。
- 公开报告三种尺寸和打印介质下无裁切。

完整门禁：

```bash
npm run test:managed
```

真实 Provider 保持禁用，不运行付费调用。
