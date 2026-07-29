# C3 Settings 与账号数据生命周期设计

## 范围

C3 只交付三条用户路径：保存界面语言、删除单个研究项目、删除当前测试账号。复用现有 Supabase、RLS、项目列表和应用外壳，不增加依赖，不调用 Provider，不操作 Production。

## 用户体验

- 工作台导航增加“设置”，进入 `/{locale}/app/settings`。
- 设置页显示当前 GitHub 账号摘要和语言选择。保存后更新 `profiles.language`、`NEXT_LOCALE` cookie，并跳转到所选语言的设置页。
- 项目仍从研究项目列表删除，使用现有确认框。删除后项目、研究数据和公开报告 slug 均不可访问。
- 危险区要求用户输入页面显示的账号名。服务端重新从当前会话取得账号名并严格比对，成功后删除账号及其所有数据并返回站点首页。

## 数据与安全

- `profiles.language` 是持久化偏好，`NEXT_LOCALE` 用于后续无显式语言入口的路由选择；显式 URL 语言仍优先。
- 项目删除继续使用带 `owner_id` 条件的 authenticated 查询和 RLS。现有项目外键已覆盖 Source、Chunk、Claim、Evidence、Run、Report、Checkpoint、Log 和 Audit 的级联删除。
- 账号删除只在 Server Action 中调用 service-role Admin API。客户端不提供 user id；服务端从已验证会话派生 user id 和确认文本。
- 删除 `auth.users` 后，现有 `ON DELETE CASCADE` 清理 Profile、Project 和 Usage；Project 再级联所有研究数据。随后执行 local sign-out，旧会话不能继续访问。
- 不额外拉起 GitHub OAuth。当前有效 Supabase 会话加精确账号名确认是本里程碑的确认门禁。

## 错误处理

- 非法语言或确认文本不匹配返回表单错误，不执行写入。
- Profile 更新、项目删除或 Admin 删除失败时显示可重试错误，不使用成功跳转掩盖失败。
- 已删除或跨用户项目统一表现为不存在。

## 验证

- 单元测试覆盖 Profile 读取/更新、Server Action 输入与依赖编排、双语 Settings UI 和导航。
- pgTAP 覆盖跨用户隔离、项目完整级联、账号完整级联和公开 slug 失效。
- 聚焦 E2E 覆盖匿名 Settings 边界；托管开发环境用测试项目和专用测试账号完成浏览器验收。
- 最终运行模块门禁、三档视口检查、独立 Claude 审核和 CI。

## 明确不做

不实现账单、团队、角色、完整导出、Production 删除、`release` 更新或 C4 功能。
