# C1 托管开发数据库与本地研究闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 不启动本地 Supabase Docker，让本地 Next.js 和最小可调度的 5 worker Inngest 连接当前托管开发 Supabase，并从 GitHub 登录开始完成 fixture 与受限真实研究闭环，最后用一个 Draft PR 交付用户一次性验收。

**Architecture:** `.env.local` 显式允许一个托管 Supabase Project Ref，本地启动器只校验环境并编排 Next.js 与 Inngest，不创建或修改数据库容器。fixture 与 live 使用同一持久化工作流；live runtime 额外注入来源、正文、embedding 批次和费用上限。托管数据库运行事务内 pgTAP 与 lint，本地不运行 Docker；迁移链重建继续由 GitHub Actions 的独立数据库 job 在云端完成。

**Tech Stack:** Next.js 16.2、React 19、TypeScript、Supabase Auth/Postgres/RLS、Inngest 4 / CLI 1.38.1、Vitest、Playwright、Node.js 22。

---

## 文件职责

- `scripts/local-development.mjs`：托管环境校验、`.env.local` 权限检查、fixture/live profile 和 Next/Inngest 子进程编排；不得调用 Supabase 或 Docker 启动命令。
- `scripts/hosted-database-gate.mjs`：核对本地 link 与显式允许的 Project Ref，然后只运行 linked pgTAP 与 linked lint。
- `src/providers/live/local-research-gate.ts`：定义 C1 live 的确认令牌、费用和资源上限。
- `src/providers/runtime.ts`：把 Provider 与本地 execution limits 作为同一个 runtime 返回；Production 行为不变。
- `src/features/research/run-research-workflow.ts`：执行 embedding 批次硬上限；其余来源和正文限制继续使用 run 字段。
- `src/inngest/functions/run-research.ts`：压缩 durable Provider replay，并把本地 runtime limits 收窄到当前执行快照。
- `tests/unit/local-development.test.ts`：纯函数验证托管环境、命令参数、无 Docker 合约和敏感值不泄漏。
- `tests/unit/hosted-database-gate.test.ts`：验证 linked Project Ref 和远端事务测试命令。
- `tests/unit/hosted-development-auth.test.ts`：验证 GitHub OAuth loopback callback 和安全 next path，不保留 anonymous 登录。
- `.github/workflows/ci.yml`：数据库迁移重建和 pgTAP 继续只在 GitHub runner 使用 Docker。
- `README.md`、`docs/deployment.md`、`.env.example`：记录托管开发数据库、本地无 Docker、fixture/live 入口和 Production 冻结边界。

### Task 1: 收口已在工作区中的 Inngest replay 压缩修复

**Files:**
- Modify: `src/inngest/functions/run-research.ts`
- Test: `tests/unit/inngest-research.test.ts`

这两处修改已经按 TDD 写入工作区但尚未提交。不要撤销或重写为另一套格式。

- [ ] **Step 1: 检查现有差异只压缩 durable replay**

Run:

```bash
git diff -- src/inngest/functions/run-research.ts tests/unit/inngest-research.test.ts
```

Expected: JSON Provider 结果使用 `gzip-json-base64`；embedding 使用 `float32-gzip-base64`；恢复逻辑兼容未压缩旧格式；测试不包含真实响应正文。

- [ ] **Step 2: 运行聚焦测试**

Run:

```bash
npm run test:unit -- tests/unit/inngest-research.test.ts
npm run typecheck
```

Expected: 两条命令均 PASS；不启动服务，不调用 Provider。

- [ ] **Step 3: 提交 replay 修复**

```bash
git add src/inngest/functions/run-research.ts tests/unit/inngest-research.test.ts
git commit -m "fix(inngest): 压缩本地 Provider 重放结果"
```

### Task 2: 把本地启动器改为托管 Supabase 与双 profile

**Files:**
- Modify: `scripts/local-development.mjs`
- Modify: `tests/unit/local-development.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.example`

- [ ] **Step 1: 重写启动器失败测试**

用以下合约替换本地 Supabase merge、environment rewrite 和 `supabase start` 断言：

```ts
expect(
  readHostedSupabaseProjectRef("https://dibngceljmdkcgrzxubx.supabase.co"),
).toBe("dibngceljmdkcgrzxubx");

expect(
  validateHostedDevelopmentEnvironment({
    profile: "fixture",
    environment: {
      NEXT_PUBLIC_SUPABASE_URL:
        "https://dibngceljmdkcgrzxubx.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable",
      SUPABASE_SERVICE_ROLE_KEY: "secret",
      LOCAL_DEVELOPMENT_SUPABASE_PROJECT_REF: "dibngceljmdkcgrzxubx",
    },
  }),
).toEqual({
  profile: "fixture",
  projectRef: "dibngceljmdkcgrzxubx",
});

expect(createLocalServiceSpecs({ profile: "live", projectRoot })).toEqual(
  expect.arrayContaining([
    expect.objectContaining({
      name: "inngest",
      args: expect.arrayContaining([
        "--queue-workers",
        "5",
        "--tick",
        "1000",
        "--persist",
        "--log-level",
        "warn",
      ]),
    }),
  ]),
);
```

同时读取 `scripts/local-development.mjs` 和 `package.json`，断言：

```ts
expect(source).not.toContain('"start"');
expect(source).not.toContain("supabase status");
expect(packageJson.scripts["dev:local"]).toContain("--profile=fixture");
expect(packageJson.scripts["dev:local:live"]).toContain("--profile=live");

expect(parseLocalDevelopmentArguments(["--profile=fixture", "--check"])).toEqual({
  checkOnly: true,
  profile: "fixture",
});
```

- [ ] **Step 2: 确认测试 RED**

Run:

```bash
npm run test:unit -- tests/unit/local-development.test.ts
```

Expected: FAIL，因为托管 URL 校验、profile 和轻量 Inngest 参数尚未实现。

- [ ] **Step 3: 实现托管环境校验**

`scripts/local-development.mjs` 导出以下接口：

```js
export const readHostedSupabaseProjectRef = (rawUrl) => {
  const url = new URL(rawUrl);
  const match = /^([a-z0-9]+)\.supabase\.co$/.exec(url.hostname);

  if (url.protocol !== "https:" || !match) {
    fail("HOSTED_SUPABASE_URL_INVALID");
  }

  return match[1];
};

export const validateHostedDevelopmentEnvironment = ({
  environment,
  profile,
}) => {
  const projectRef = readHostedSupabaseProjectRef(
    requireEnvironmentValue(environment, "NEXT_PUBLIC_SUPABASE_URL"),
  );
  requireEnvironmentValue(
    environment,
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  );
  requireEnvironmentValue(environment, "SUPABASE_SERVICE_ROLE_KEY");

  if (
    requireEnvironmentValue(
      environment,
      "LOCAL_DEVELOPMENT_SUPABASE_PROJECT_REF",
    ) !== projectRef
  ) {
    fail("HOSTED_SUPABASE_PROJECT_REF_MISMATCH");
  }

  if (profile === "live") {
    validateLocalLiveEnvironment(environment);
  } else if (profile !== "fixture") {
    fail("LOCAL_DEVELOPMENT_PROFILE_INVALID");
  }

  return { profile, projectRef };
};
```

读取 `.env.local` 时拒绝符号链接并执行 `chmod 0600`，但不再序列化、覆盖或合并文件内容。缺变量错误只包含变量名或稳定错误码。

- [ ] **Step 4: 实现 fixture/live 本地进程规格**

`createLocalServiceSpecs` 返回固定 `3218/8288` 端口。Inngest 使用：

```js
[
  "dev",
  "--no-discovery",
  "--host",
  "127.0.0.1",
  "--port",
  "8288",
  "--sdk-url",
  "http://127.0.0.1:3218/api/inngest",
  "--queue-workers",
  "5",
  "--tick",
  "1000",
  "--persist",
  "--log-level",
  "warn",
]
```

Inngest cwd 使用 Git 忽略的 `output/inngest`；启动前 `mkdir({ recursive: true })`。两个 profile 都显式设置 `INNGEST_DEV=1`；fixture 设置 `RESEARCH_PROVIDER_MODE=fixture`，live 设置 `RESEARCH_PROVIDER_MODE=live`。子进程退出和 `SIGINT/SIGTERM` 继续终止整组本地进程。

实现 `--check`：只运行 Node 版本、`.env.local` 权限、托管 Project Ref、profile 和端口校验，输出 `[local-dev] ready` 后退出，不创建 `output/inngest`，不启动任何子进程。

- [ ] **Step 5: 更新命令与环境模板**

`package.json` 使用：

```json
{
  "dev:local": "node --env-file-if-exists=.env.local scripts/local-development.mjs --profile=fixture",
  "dev:local:live": "node --env-file-if-exists=.env.local scripts/local-development.mjs --profile=live"
}
```

`.env.example` 删除 `LOCAL_DEV_AUTH_ENABLED`，新增：

```text
LOCAL_DEVELOPMENT_SUPABASE_PROJECT_REF=
```

Provider live 确认和 `0.15` 费用变量继续保留。

- [ ] **Step 6: 确认 GREEN 并提交**

Run:

```bash
npm run test:unit -- tests/unit/local-development.test.ts
```

Expected: PASS；测试进程列表中不存在 Supabase 或 Docker 命令。

Commit:

```bash
git add scripts/local-development.mjs tests/unit/local-development.test.ts package.json package-lock.json .env.example
git commit -m "feat(dev): 改用托管数据库本地运行"
```

### Task 3: 删除 anonymous 开发登录并验证 GitHub loopback OAuth

**Files:**
- Delete: `src/features/auth/local-development.ts`
- Delete: `tests/unit/local-development-auth.test.tsx`
- Create: `tests/unit/hosted-development-auth.test.ts`
- Modify: `src/features/auth/actions.ts`
- Modify: `src/app/[locale]/auth/login/page.tsx`
- Modify: `src/app/[locale]/auth/login/login.module.css`
- Modify: `messages/zh.json`
- Modify: `messages/en.json`
- Modify: `supabase/config.toml`

- [ ] **Step 1: 写 GitHub callback 失败测试**

Mock `next/headers`、Supabase client 和 `next/navigation`，断言：

```ts
await signInWithGitHub("zh", "https://attacker.example/escape");

expect(signInWithOAuth).toHaveBeenCalledWith({
  provider: "github",
  options: {
    redirectTo:
      "http://127.0.0.1:3218/auth/callback?locale=zh&next=%2Fzh%2Fapp",
  },
});
expect(redirect).toHaveBeenCalledWith("https://github.example/authorize");
```

再读取登录页与 `supabase/config.toml`，断言不存在 `signInAnonymously`，且：

```ts
expect(config).toContain("enable_anonymous_sign_ins = false");
expect(config).toContain(
  'additional_redirect_urls = ["http://127.0.0.1:3218/auth/callback"]',
);
```

- [ ] **Step 2: 确认测试 RED**

Run:

```bash
npm run test:unit -- tests/unit/hosted-development-auth.test.ts
```

Expected: FAIL，因为 anonymous action、入口和配置仍存在。

- [ ] **Step 3: 删除 anonymous 路径**

删除 `signInForLocalDevelopment`、`isLocalDevelopmentAuthEnabled`、本地登录按钮、对应 CSS 和中英文 `Auth.local` 文案。保留现有 GitHub 主按钮和 `/auth/callback` route，不新增硬编码邮箱或密码。

`supabase/config.toml` 保持本地 callback 为 `3218`，把 `enable_anonymous_sign_ins` 恢复为 `false`。不得对托管项目运行 `supabase config push`。

- [ ] **Step 4: 确认 GREEN 并提交**

Run:

```bash
npm run test:unit -- tests/unit/hosted-development-auth.test.ts tests/unit/auth-session.test.ts tests/unit/auth-server-session.test.ts
```

Expected: PASS；只有 GitHub OAuth 登录路径。

Commit:

```bash
git add src/features/auth src/app/[locale]/auth/login messages supabase/config.toml tests/unit/hosted-development-auth.test.ts tests/unit/local-development-auth.test.tsx
git commit -m "feat(auth): 本地复用 GitHub 托管登录"
```

### Task 4: 增加本地 live 的来源、正文和 embedding 批次上限

**Files:**
- Modify: `src/providers/live/local-research-gate.ts`
- Modify: `src/providers/runtime.ts`
- Modify: `src/features/research/run-research-workflow.ts`
- Modify: `src/inngest/functions/run-research.ts`
- Modify: `tests/unit/live-providers.test.ts`
- Modify: `tests/unit/research-workflow.test.ts`
- Modify: `tests/unit/inngest-research.test.ts`

- [ ] **Step 1: 写 runtime limits 失败测试**

`tests/unit/live-providers.test.ts` 要求本地 live 返回：

```ts
expect(createResearchProviders({ environment: localLiveEnvironment })).toMatchObject({
  mode: "live",
  maxCostUsd: 0.15,
  executionLimits: {
    sourceLimit: 4,
    maxContentChars: 40_000,
    maxEmbeddingBatches: 20,
  },
});
```

同时断言 fixture 与 Production `executionLimits` 为 `undefined`，保持既有产品上限。

- [ ] **Step 2: 写 workflow embedding 批次失败测试**

在 `tests/unit/research-workflow.test.ts` 创建产生 11 个以上 Chunk 的 fixture，以 `maxEmbeddingBatches: 1` 执行并断言：

```ts
await expect(runResearchWorkflow(input)).resolves.toMatchObject({
  run: {
    status: "failed",
    errorMessage: "EMBEDDING_BATCH_LIMIT_EXCEEDED",
  },
});
expect(providers.calls.some((call) => call.operation === "embed")).toBe(false);
```

在 `tests/unit/inngest-research.test.ts` 让 persisted run 保持 `12 / 200000`，本地 runtime 返回 `4 / 40000 / 20`，断言最终 snapshot 中执行 run 被收窄为 `4 / 40000`，且数据库输入对象未被原地修改。

- [ ] **Step 3: 确认测试 RED**

Run:

```bash
npm run test:unit -- tests/unit/live-providers.test.ts tests/unit/research-workflow.test.ts tests/unit/inngest-research.test.ts
```

Expected: FAIL，因为 execution limits 和 embedding 批次上限尚不存在。

- [ ] **Step 4: 实现本地 execution limits**

`readLocalResearchEnvironment` 返回：

```ts
return {
  costLimitUsd,
  executionLimits: {
    sourceLimit: 4,
    maxContentChars: 40_000,
    maxEmbeddingBatches: 20,
  },
};
```

`ResearchProviders` 新增可选字段：

```ts
executionLimits?: {
  sourceLimit: number;
  maxContentChars: number;
  maxEmbeddingBatches: number;
};
```

只有非 Production live runtime 写入该字段。

- [ ] **Step 5: 实现 workflow 批次上限与 Inngest 快照收窄**

`RunResearchWorkflowInput` 新增 `maxEmbeddingBatches?: number`。使用固定 batch size 10，默认上限继续覆盖现有 1500 Chunk：

```ts
const EMBEDDING_BATCH_SIZE = 10;
const DEFAULT_MAX_EMBEDDING_BATCHES = 150;

if (
  !Number.isInteger(maxEmbeddingBatches) ||
  maxEmbeddingBatches < 1 ||
  maxEmbeddingBatches > DEFAULT_MAX_EMBEDDING_BATCHES
) {
  throw new Error("EMBEDDING_BATCH_LIMIT_INVALID");
}

if (Math.ceil(chunks.length / EMBEDDING_BATCH_SIZE) > maxEmbeddingBatches) {
  throw new Error("EMBEDDING_BATCH_LIMIT_EXCEEDED");
}
```

把 `EMBEDDING_BATCH_LIMIT_EXCEEDED` 加入稳定 workflow error 集合。Inngest executor 创建新的 `effectiveRun`，用 `Math.min` 收窄 `sourceLimit` 和 `maxContentChars`，并把 `maxEmbeddingBatches` 传给工作流；不得改写数据库行或 Production 默认值。

- [ ] **Step 6: 确认 GREEN 并提交**

Run:

```bash
npm run test:unit -- tests/unit/live-providers.test.ts tests/unit/research-workflow.test.ts tests/unit/inngest-research.test.ts
```

Expected: PASS；本地 live 为 `4 / 40000 / 20 / 0.15`，fixture 与 Production 不变。

Commit:

```bash
git add src/providers src/features/research/run-research-workflow.ts src/inngest/functions/run-research.ts tests/unit/live-providers.test.ts tests/unit/research-workflow.test.ts tests/unit/inngest-research.test.ts
git commit -m "feat(provider): 限制本地真实研究资源"
```

### Task 5: 分离托管数据库门禁与 CI Docker 门禁

**Files:**
- Create: `scripts/hosted-database-gate.mjs`
- Create: `tests/unit/hosted-database-gate.test.ts`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: 写数据库命令失败测试**

测试纯函数：

```ts
expect(
  assertLinkedProjectRef({
    allowedProjectRef: "dibngceljmdkcgrzxubx",
    linkedProjectRef: "dibngceljmdkcgrzxubx\n",
  }),
).toBe("dibngceljmdkcgrzxubx");

expect(() =>
  assertLinkedProjectRef({
    allowedProjectRef: "dibngceljmdkcgrzxubx",
    linkedProjectRef: "other-project",
  }),
).toThrow("HOSTED_SUPABASE_LINK_MISMATCH");

expect(createHostedDatabaseCommands()).toEqual([
  ["test", "db", "--linked"],
  ["db", "lint", "--linked", "--level", "warning"],
]);
```

读取 `package.json` 与 CI workflow，断言本地 `test:managed` 不含 `--local` 或 `db reset`，CI database job 使用 `test:db:ci`。

- [ ] **Step 2: 确认测试 RED**

Run:

```bash
npm run test:unit -- tests/unit/hosted-database-gate.test.ts
```

Expected: FAIL，因为 linked gate 尚不存在。

- [ ] **Step 3: 实现 linked gate**

脚本从 `LOCAL_DEVELOPMENT_SUPABASE_PROJECT_REF` 读取允许值，从 Git 忽略的 `supabase/.temp/project-ref` 读取 CLI link。两者不一致或缺失时在任何远端命令前退出。

匹配后按顺序 `spawn` 本地固定版本 `supabase`：

```js
[
  ["test", "db", "--linked"],
  ["db", "lint", "--linked", "--level", "warning"],
]
```

pgTAP 文件均以 `begin` 开始、`rollback` 结束；脚本不得执行 `db reset --linked`、seed、migration push 或数据清理。

- [ ] **Step 4: 更新 package 与 CI 职责**

`package.json` 使用：

```json
{
  "test:db": "npm run test:db:hosted",
  "test:db:hosted": "node --env-file-if-exists=.env.local scripts/hosted-database-gate.mjs",
  "test:db:ci": "supabase db reset --local && supabase test db --local && supabase db lint --local --level warning",
  "test:managed": "npm run check:provider-boundary && npm run test:db:hosted && npm run test:ci"
}
```

`.github/workflows/ci.yml` 保留 `npx supabase db start` 和最终 `supabase stop --no-backup`，只把 database gate 改为 `npm run test:db:ci`。Docker 因而只运行在 GitHub runner。

- [ ] **Step 5: 确认 GREEN 并提交**

Run:

```bash
npm run test:unit -- tests/unit/hosted-database-gate.test.ts tests/unit/local-development.test.ts
```

Expected: PASS；没有连接远端，也没有启动 Docker。

Commit:

```bash
git add scripts/hosted-database-gate.mjs tests/unit/hosted-database-gate.test.ts package.json .github/workflows/ci.yml
git commit -m "test(database): 分离托管与 CI 数据库门禁"
```

### Task 6: 更新本地开发与部署文档

**Files:**
- Modify: `README.md`
- Modify: `docs/deployment.md`
- Modify: `PROJECT_STATUS.md`
- Modify: `docs/roadmap.md`

- [ ] **Step 1: 更新 README**

明确记录：

```text
npm run dev:local       # 托管 Supabase + fixture Provider
npm run dev:local:live  # 托管 Supabase + 受限真实 Provider
npm run test:managed    # linked pgTAP + fixture 工程门禁，不启动本机 Docker
```

删除 Docker、本地 Studio、`supabase status` 和 anonymous 登录说明。写明本地登录使用 GitHub OAuth，固定入口为 `http://127.0.0.1:3218/zh/auth/login`。

- [ ] **Step 2: 更新部署与状态文档**

`docs/deployment.md` 区分：

- 当前 Supabase 在 C1-C6 期间是托管开发数据库。
- `test:db:hosted` 只运行事务内 pgTAP 和 lint。
- GitHub Actions database job 才重建 migration 并使用 Docker。
- 不得对托管开发项目执行 `supabase config push` 或远端 reset。
- C6 前 `release`、Vercel、Production Inngest 和正式发布继续冻结。

`PROJECT_STATUS.md` 只记录实现进度，不把计划完成写成 C1 完成。

- [ ] **Step 3: 验证文档并提交**

Run:

```bash
git diff --check
rg -n "本地 Supabase Studio|supabase status|LOCAL_DEV_AUTH_ENABLED|启动或复用本地 Supabase" README.md docs/deployment.md PROJECT_STATUS.md docs/roadmap.md
```

Expected: `git diff --check` PASS；`rg` 无匹配。

Commit:

```bash
git add README.md docs/deployment.md PROJECT_STATUS.md docs/roadmap.md
git commit -m "docs(dev): 记录托管数据库本地流程"
```

### Task 7: 完成自动化门禁和托管数据库真实链路验证

**Files:**
- Modify: `PROJECT_STATUS.md`

- [ ] **Step 1: 配置并验证本地托管环境，不打印值**

`.env.local` 必须包含托管 URL、Publishable Key、Service Role Key、允许的 Project Ref 和已有 Provider 变量，权限为 `0600`。运行：

```bash
PROJECT_REF="$(node --env-file-if-exists=.env.local -e 'process.stdout.write(process.env.LOCAL_DEVELOPMENT_SUPABASE_PROJECT_REF ?? "")')"
npx supabase link --project-ref "$PROJECT_REF"
unset PROJECT_REF
node --env-file-if-exists=.env.local scripts/local-development.mjs --profile=fixture --check
```

实施时让启动器支持 `--check`：只完成 Node、环境、文件权限和端口校验，然后退出；不得启动服务。Expected: 只输出稳定的 ready 状态，不输出 URL、Project Ref、Key 或 Provider payload。

- [ ] **Step 2: 验证托管 GitHub OAuth 配置**

在当前 Supabase Auth URL Configuration 中确认 exact redirect：

```text
http://127.0.0.1:3218/auth/callback
```

缺失时只追加这一项；不得修改 GitHub Client Secret，不得运行 `supabase config push`，不得删除现有 Production redirect。

- [ ] **Step 3: 处理被中断的旧 C1 run**

通过 Service Role 查询 `queued/running` 且早于本次会话的 C1 run。只把确认属于此前中断测试的 run 标记为 `failed/failed` 并使用稳定错误 `WORKFLOW_INTERRUPTED`；不删除来源、报告或其他项目。若当前开发 owner 已达到当月 3 次开发配额，只重置该 owner 当前月的 `usage_monthly` 开发计数，保留其他 owner 和历史月份。整个操作不得输出 owner、问题正文或密钥。

- [ ] **Step 4: 运行聚焦和完整无付费门禁**

Run:

```bash
npm run check:provider-boundary
npm run test:unit -- tests/unit/local-development.test.ts tests/unit/hosted-database-gate.test.ts tests/unit/hosted-development-auth.test.ts tests/unit/live-providers.test.ts tests/unit/research-workflow.test.ts tests/unit/inngest-research.test.ts
npm run typecheck
npm run test:managed
```

Expected: 全部 PASS；linked pgTAP 回滚测试数据；Provider 计数为 0；本机 Evidence Graph Docker 容器为 0。

- [ ] **Step 5: 内部完成 fixture UI 闭环**

Run:

```bash
npm run dev:local
```

使用浏览器从 GitHub 登录，通过 UI 创建标题 `C1 fixture research` 的中文研究。确认 `queued -> running -> ready`，并检查来源、Claim、Evidence、运行日志和草稿报告。该流程必须使用 fixture Provider，费用和外呼次数为 0。完成后停止 Next 与 Inngest。

- [ ] **Step 6: 内部完成一条真实 UI 研究**

用户已授权本地真实 Provider 调用；仍必须通过 `.env.local` 的精确确认和 `0.15 USD` 上限。Run:

```bash
npm run dev:local:live
```

从 UI 创建中文问题：

```text
Supabase 官方文档如何建议保护 service_role 密钥？
```

确认研究在最多 4 个来源、40,000 字符、20 个 embedding 批次和 `0.15 USD` 内达到 ready，或以稳定错误明确失败。记录只包含状态、搜索次数、token 数、来源数、批次数和估算费用，不记录来源全文或 Provider 原始响应。

- [ ] **Step 7: 检查资源并停止服务**

Run:

```bash
docker ps --format '{{.Names}}' | rg 'evidence|supabase' || true
lsof -nP -iTCP:3218 -sTCP:LISTEN
lsof -nP -iTCP:8288 -sTCP:LISTEN
```

Expected: 运行期间只有 Next 与 Inngest 端口；没有 Evidence Graph Docker 容器。记录两个本地进程的 RSS。内部验证结束后终止进程并再次确认端口关闭。

- [ ] **Step 8: 修复内部验证发现的 C1 阻塞问题**

每个成立问题单独执行：失败测试或稳定复现 -> 最小修复 -> 聚焦 GREEN -> 中文 Conventional Commit。只修复阻止登录、项目列表、fixture/live 研究完成或资源边界生效的 P0/P1；其他体验建议记录到 C2，不扩展 C1。

### Task 8: 完整收口、唯一 Draft PR 和用户一次性验收

**Files:**
- Modify: `PROJECT_STATUS.md`
- Modify: `docs/superpowers/plans/2026-07-23-c1-local-live-research-plan.md`
- Create locally only: `output/c1-pr-body.md`

- [ ] **Step 1: 重新运行最终门禁**

Run:

```bash
git diff --check
npm run test:managed
git status --short
git ls-files '.env*'
```

Expected: 全部门禁 PASS；只列出 `.env.example`；没有未提交实现文件；不调用真实 Provider。

- [ ] **Step 2: 更新计划与状态**

勾选实际完成项。`PROJECT_STATUS.md` 记录：分支、最终 commit SHA、自动化数量、fixture 结果、真实研究脱敏汇总、无 Docker 证据和下一步为 Draft PR 用户验收。不得把 C1 标记为已完成。

Commit:

```bash
git add PROJECT_STATUS.md docs/superpowers/plans/2026-07-23-c1-local-live-research-plan.md
git commit -m "docs(status): 记录 C1 本地验收候选"
```

- [ ] **Step 3: 推送并创建唯一 Draft PR**

在 Git 忽略的 `output/c1-pr-body.md` 写入目标、主要改动、门禁结果、真实研究脱敏汇总、用户验收清单和明确不做。Run:

```bash
git push -u origin feat/c1-local-live-research
gh pr create --draft --base main --head feat/c1-local-live-research --title "feat: 完成本地真实研究运行环境" --body-file output/c1-pr-body.md
```

Expected: 只创建一个 C1 Draft PR；不更新 `release`，不触发 Vercel Preview 或 Production。

- [ ] **Step 4: 把 PR 状态写回同一分支**

把 PR 编号、head SHA 和 CI 状态写入 `PROJECT_STATUS.md`，提交并 push 到同一 PR：

```bash
git add PROJECT_STATUS.md
git commit -m "docs(status): 记录 C1 Draft PR"
git push
```

- [ ] **Step 5: 启动最终验收环境**

Run:

```bash
npm run dev:local:live
```

向用户提供 `http://127.0.0.1:3218/zh/auth/login` 和一份完整清单，一次性验收 GitHub 登录、项目列表、研究创建、状态推进、来源、Claim、Evidence、运行日志和带引文报告。服务保持运行到用户完成测试；不启动 Docker。

- [ ] **Step 6: 等待用户结论，不提前审核或合并**

用户验收前不运行独立 Claude review、不把 C1 标记为完成、不合并 PR、不开始 C2。若用户发现阻塞问题，在同一分支和同一 PR 按 TDD 修复，重新运行相关门禁并恢复同一验收 URL。

用户明确通过后，才按 `AGENT.md` 执行独立 Claude review、修复 finding、等待 CI，并使用 merge commit 合并唯一 C1 PR。
