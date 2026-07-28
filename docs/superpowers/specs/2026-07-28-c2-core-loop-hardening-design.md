# C2 核心研究闭环与 P0/P1 缺陷收敛设计

日期：2026-07-28
分支：`feat/c2-core-loop-hardening`
状态：范围已冻结，按用户授权直接推进

## 1. 目标

围绕“创建研究 -> 运行 -> 检查证据 -> 审核 Claim -> 发布/撤销报告”关闭当前已复现的 P1，确保人工审核会真实约束最终公开报告，而不是只改变工作台中的状态标签。

C2 不增加新的研究产品形态。它收敛现有能力的正确性、恢复能力和状态表达，并保持 Production 冻结。

## 2. 浏览器走查与有限问题清单

2026-07-28 使用用户现有 GitHub 登录态 Chrome 对托管开发环境完成桌面和 390x844 移动端走查。当前有限问题清单为：

| ID | 等级 | 复现证据 | 影响 |
| --- | --- | --- | --- |
| C2-P1-01 | P1 | 一个真实项目摘要显示 20 条 Claim，默认列表只显示 11 条；9 条没有 Evidence Link 的 Claim 被关系筛选永久隐藏 | 用户无法审核证据不足的 Claim，人工审核不完整 |
| C2-P1-02 | P1 | 将已经进入草稿的 Claim 标记为 rejected 后，报告正文仍包含该 Claim，且“发布此版本”保持可用 | 被拒绝或尚未审核的结论可以进入公开报告 |
| C2-P1-03 | P1 | 新建研究因月额度失败后，标题、问题和来源 URL 全部清空 | 失败不可恢复，用户必须重新输入完整研究范围 |
| C2-P1-04 | P1 | 已完成研究的项目在项目列表仍显示“进行中”；该标签实际对应项目 `active` 生命周期，而不是研究运行状态 | 关键状态误导，用户无法区分“活跃项目”和“运行中任务” |

本周期没有已确认的 P0。走查中未复现横向溢出、移动端控件遮挡、OAuth 中断、报告列表查询失败或 Claim 审核持久化失败。

## 3. 方案比较

### 方案 A：只在发布前要求所有引用 Claim 为 accepted

优点是改动最小。缺点是任何 rejected Claim 都会让当前草稿永久无法发布，而产品又没有报告编辑器；用户完成拒绝操作后反而走不完主链路，因此不采用。

### 方案 B：人工审核后重新调用模型生成报告

语义最完整，但会引入新的付费调用、异步任务、幂等和费用门禁，并把 C2 扩展成新的 Provider 工作流，不符合有限缺陷收敛范围，因此不采用。

### 方案 C：从模型草稿确定性生成已审核报告版本

采用此方案。发布前要求草稿引用的 Claim 不再有 pending；随后按草稿段落中的持久化 Citation 标记生成一个新版本：只保留全部引用 Claim 均为 accepted 的段落，涉及 rejected Claim 的段落整体排除。原始草稿保留，新版本在数据库事务中创建并发布，不调用 Provider。

该方案能让“接受 / 拒绝”真实影响最终报告，同时保留原始模型输出和完整审计路径。

## 4. Claim 审核与展示

Claim 列表只由人工审核状态筛选，不再受图谱关系筛选控制。关系筛选继续只控制图谱节点、Evidence Link 和当前 Source 选择。

因此：

- 没有 Evidence Link 的 Claim 仍显示在列表中，并明确显示 0 条证据。
- 用户可以把证据不足的 Claim 标记为 rejected。
- `全部 / 待审核 / 已接受 / 已拒绝` 继续控制 Claim 列表。
- 支持、反驳、限定、上下文复选框只改变图谱，不会让待审核 Claim 从列表消失。
- 工作台摘要和列表总数使用同一组 Claim，避免 20 与 11 的无说明差异。

选择没有 Evidence Link 的 Claim 时，Source 面板显示现有空态，不伪造来源或自动跳到其他 Claim 的证据。

## 5. 已审核报告版本

### 5.1 发布前检查

发布动作以所选草稿或已撤销版本为基础。系统读取该报告 Citation 引用的当前 Claim 状态：

- 存在 pending：返回 `REPORT_REVIEW_INCOMPLETE`，不写新版本、不改变公开状态。
- 所有引用 Claim 都是 rejected，或过滤后没有事实段落：返回 `REPORT_NO_ACCEPTED_CONTENT`。
- accepted 与 rejected 混合且没有 pending：允许生成已审核版本。

不被该报告引用的 Claim 不阻止该报告发布，但仍保留在工作台供用户审核。

### 5.2 确定性段落过滤

工作流保存的每个报告段落在 Markdown 中带持久化 Evidence Link 标记。生成已审核版本时：

1. 按空行拆分 section Markdown 中的段落。
2. 只识别该 section `citationIds` 中存在的标记，不解析任意方括号文本。
3. 非事实且没有 Citation 的段落原样保留。
4. 一个事实段落的所有 Citation Claim 都为 accepted 时保留。
5. 一个段落只要包含 rejected Claim 就整体排除，避免保留无法精确拆分的混合结论。
6. 删除空 section，重新计算 section `citationIds`、报告 `citations` 和顶层 Markdown。
7. 结果继续满足“每个事实段落至少一个完整 Citation”的发布约束。

### 5.3 版本和事务

新增数据库 RPC，在一个事务中完成：

- 从 `auth.uid()` 推导 owner 并锁定项目和基础报告。
- 再次检查基础报告所引用 Claim 没有 pending。
- 验证新快照 Citation 是基础报告 Citation 的子集，且每个 Claim 当前为 accepted。
- 使用 `max(project.version) + 1` 创建新的不可变报告版本。
- 撤销旧 published 版本并发布新版本，保持项目稳定 slug。
- 更新项目公开状态并写入包含基础报告 ID 和新版本号的审计事件。

已发布快照保持不可变。用户之后修改 Claim 审核状态不会静默改写公开内容；要改变公开内容，必须再次从草稿生成并发布一个新版本，或撤销公开报告。

## 6. 报告工作台交互

`WorkspaceReport` 接收当前 Claim 状态并展示发布准备度：

- 有 pending 时禁用发布按钮，显示还需审核的引用 Claim 数量，并提供“审核下一条”动作。
- 点击“审核下一条”会选中对应 Claim；移动端同时切回“主张”标签。
- 有 rejected 且没有 pending 时，说明发布版本将排除相关段落，发布按钮仍可用。
- 发布成功后把 RPC 返回的新完整报告加入版本选择器，选中新版本，并把旧公开版本更新为 revoked。
- `REPORT_REVIEW_INCOMPLETE` 与 `REPORT_NO_ACCEPTED_CONTENT` 使用独立双语错误，不再统一显示无法行动的“发布失败”。

Demo 工作台不调用写动作，继续展示固定公开示例。

## 7. 创建研究失败恢复

`NewResearchForm` 把标题、问题、语言和每个手动 URL 保存为受控草稿状态。Server Action 返回校验错误、活跃任务冲突或月额度错误时：

- 所有已输入值和 URL 行数量保持不变。
- 错误仍使用现有 `role="alert"` 和字段关联。
- 提交期间继续禁用按钮并显示 loading。
- 成功仍由 Server Action redirect，客户端不额外清空表单。

不把表单内容写入 localStorage，也不跨浏览器会话保存。

## 8. 项目状态表达

项目列表的 `active` 生命周期文案改为中文“活跃”、英文继续为“Active”。工作台内的 queued、running、ready、failed 仍表达最新研究运行状态，两种状态不再使用相同含义的文案。

本周期不新增项目运行状态查询列，也不改变归档、删除或 RLS 语义。

## 9. 数据与安全边界

- 新迁移只新增或替换报告发布 RPC，不新增表、不修改 RLS、不触碰 Production。
- RPC 不接受 owner ID，所有权只能来自 `auth.uid()`。
- 客户端只提交基础报告 ID；最终快照由 Server Action 基于 owner-scoped 数据确定性生成，数据库再验证当前 Claim 状态和 Citation 子集。
- 公开页继续只读取当前 published 快照，不读取实时 Claim 或来源正文。
- 例行测试保持 fixture-only，不调用 Tavily、DeepSeek 或百炼。
- 托管开发数据库应用迁移后运行 pgTAP；Production migration、环境变量、Inngest 同步和部署继续冻结。

## 10. 测试与验收

所有行为按 RED-GREEN 执行：

- 纯函数测试覆盖 pending 阻断、rejected 段落排除、混合段落整体排除、accepted 段落保留、空结果拒绝和非事实段落保留。
- Workspace 单测覆盖无证据 Claim 可见可审核、关系筛选不再隐藏 Claim、发布准备度、跳转下一条待审核 Claim和成功插入新版本。
- 新建研究表单单测覆盖三类 Server Action 错误后标题、问题、语言和多个 URL 保持。
- 项目列表单测覆盖 active 显示“活跃”，且完成态工作台仍显示“运行完成”。
- Report Store 和 Action 单测覆盖稳定错误码、新 RPC 参数、完整返回 DTO 和 owner-first 顺序。
- pgTAP 覆盖 pending 阻断、非 accepted Citation 拒绝、跨用户拒绝、版本递增、旧版本撤销、稳定 slug、审计事件和公开读取。
- E2E 覆盖完整 fixture 流程、审核全部引用 Claim、拒绝一个 Claim、发布新版本、公开页不包含被拒绝段落、撤销后 404。
- 在 390x844、1024x768、1440x1000 检查新建表单错误、20 条 Claim、报告准备度和版本发布，无横向溢出、裁切、异常重叠或图谱空白。
- 里程碑收口运行 `npm run test:managed`；受控真实研究回归仍需专用成本确认门禁。

## 11. 明确不做

- 不增加报告编辑器、任意 Markdown 编辑、重新生成按钮或 Provider 重写。
- 不实现同一项目再次发起新研究运行；该能力需要独立产品设计，不夹带在缺陷修复中。
- 不处理报告搜索、导出、团队、支付、定时研究或通用聊天。
- 不开始 C3 Settings、账号删除、Evidence Eval 或真实案例内容。
- 不更新 `release`，不修改任何 Production 资源。

## 12. 完成标准

所有 Claim 都能被看到和审核；研究创建失败不会丢失输入；项目生命周期与运行状态表达清楚；任何新公开报告都只能由已完成审核的引用 Claim 生成，被拒绝内容不会进入新公开版本；自动化、托管数据库门禁、三档浏览器验收、独立 Claude 审核和 GitHub CI 通过并以 merge commit 合并。
