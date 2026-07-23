import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const readWorkspaceFile = (path: string) =>
  readFile(join(process.cwd(), path), "utf8");

describe("paid Provider smoke command contract", () => {
  it("keeps paid smoke tests outside the default unit test config", async () => {
    const defaultConfig = await readWorkspaceFile("vitest.config.ts");
    const providerSmokeConfig = await readWorkspaceFile(
      "vitest.provider-smoke.config.ts",
    );

    expect(defaultConfig).toContain(
      'include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"]',
    );
    expect(defaultConfig).not.toContain("tests/provider-smoke/");
    expect(providerSmokeConfig).toContain('environment: "node"');
    expect(providerSmokeConfig).toContain(
      'include: ["tests/provider-smoke/live-providers.test.ts"]',
    );
  });

  it("loads ignored local credentials without supplying paid-call confirmation", async () => {
    const packageJson = JSON.parse(await readWorkspaceFile("package.json")) as {
      scripts: Record<string, string>;
    };
    const command = packageJson.scripts["test:providers:live"];

    expect(command).toBe(
      "node --env-file-if-exists=.env.local ./node_modules/vitest/vitest.mjs run --config vitest.provider-smoke.config.ts",
    );
    expect(command).not.toContain("RESEARCH_PROVIDER_MODE=live");
    expect(command).not.toContain("I_CONFIRM_PAID_PROVIDER_CALLS");
    expect(command).not.toContain("PAID_PROVIDER_SMOKE_COST_LIMIT_USD=0.10");
  });

  it("documents only the live Provider credentials and explicit smoke gate", async () => {
    const environmentTemplate = await readWorkspaceFile(".env.example");
    const deploymentGuide = await readWorkspaceFile("docs/deployment.md");

    expect(environmentTemplate).not.toContain("OPENAI_API_KEY");
    expect(environmentTemplate).toContain("TAVILY_API_KEY=");
    expect(environmentTemplate).toContain("DEEPSEEK_API_KEY=");
    expect(environmentTemplate).toContain("BAILIAN_API_KEY=");
    expect(environmentTemplate).toContain("BAILIAN_WORKSPACE_ID=");
    expect(environmentTemplate).toContain("RESEARCH_PROVIDER_MODE=");
    expect(environmentTemplate).toContain("ALLOW_PAID_PROVIDER_SMOKE=");
    expect(environmentTemplate).toContain("PAID_PROVIDER_SMOKE_COST_LIMIT_USD=");

    expect(deploymentGuide).toContain(
      "ALLOW_PAID_PROVIDER_SMOKE=I_CONFIRM_PAID_PROVIDER_CALLS",
    );
    expect(deploymentGuide).toContain(
      "PAID_PROVIDER_SMOKE_COST_LIMIT_USD=0.10",
    );
    expect(deploymentGuide).toContain("npm run test:providers:live");
    expect(deploymentGuide).toContain("Tavily、DeepSeek 和阿里云百炼");
    expect(deploymentGuide).toContain("test:managed");
    expect(deploymentGuide).toContain("零 Provider 网络请求");
    expect(deploymentGuide).toContain(
      "低于 `0.01 USD` 的成本上限会在创建 Provider 和发送请求前被拒绝",
    );
    expect(deploymentGuide).not.toContain("YES_I_ACCEPT_PROVIDER_COST");
  });
});
