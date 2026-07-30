# 拆分作品站与应用布局

## Goal

将 Ailian 个人作品站与 Evidence Graph 产品工作台拆分为独立页面壳，消除 `/app/**` 中同时出现个人站导航和产品导航的问题，让工作台在桌面端和移动端都只保留任务相关导航。

## Background

- `src/app/[locale]/layout.tsx` 当前无条件渲染 `SiteHeader` 和 `SiteFooter`。
- 受保护的 `/app/**` 页面还会渲染 `ManagedAppShell`，形成两套头部。
- `/app/research/demo` 是匿名产品 Demo，目前依赖个人站头部，拆分后必须继续提供明确产品导航。
- 用户已明确选择 Route Groups 方案 A。

## Requirements

1. 使用 Next.js Route Groups 将个人站和产品路由分组，分组不得改变任何公开 URL。
2. `/`、`/work/**`、`/notes`、`/evidence` 保留 Ailian 的 `SiteHeader` 和 `SiteFooter`。
3. `/auth/login`、`/app/**` 不显示个人站 `SiteHeader` 或 `SiteFooter`。
4. Evidence Graph 产品头部必须提供返回 Ailian 作品集、产品主页、语言切换和适合当前身份的应用导航。
5. 已登录工作台继续显示研究项目、报告库、设置、账号和退出入口。
6. 登录页和匿名 Demo 使用精简产品头部，不显示账号、退出或受保护工作台导航。
7. 中文和英文文案保持对等；键盘焦点、ARIA 标签和移动端布局保持可用。

## Acceptance Criteria

- [ ] 个人站路由只显示 Ailian 头部和 Footer。
- [ ] 登录页、匿名 Demo 和受保护工作台均只显示一个 Evidence Graph 产品头部。
- [ ] 产品头部可返回 Ailian 首页并可切换语言。
- [ ] 已登录工作台原有三个导航入口、账号摘要和退出操作保持可用。
- [ ] `/zh`、`/zh/evidence`、`/zh/auth/login`、`/zh/app`、`/zh/app/research/demo` 等 URL 不变。
- [ ] 聚焦单元测试、lint、typecheck、build 和相关 E2E 通过。
- [ ] 390x844、1024x768、1440x1000 三档页面无双头部、横向溢出、裁切或异常重叠。

## Out Of Scope

- 不拆仓库或增加独立域名。
- 不修改数据库、Supabase、OAuth 回调、RLS、Provider 或 Production。
- 不重构研究领域逻辑或报告数据流。
- 不把全部页面中的 `ManagedAppShell` 包装迁移到共享 `app/layout.tsx`。

## Open Questions

无。
