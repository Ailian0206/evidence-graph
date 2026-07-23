import {
  lstat,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";

import { describe, expect, it } from "vitest";

import {
  assertPortAvailable,
  assertSupportedNodeVersion,
  buildLocalEnvironment,
  localDevelopmentConstants,
  serializeEnvironment,
  validateLocalLiveEnvironment,
  writeEnvironmentFile,
} from "../../scripts/local-development.mjs";

const providerEnvironment = {
  RESEARCH_PROVIDER_MODE: "live",
  ALLOW_LOCAL_LIVE_RESEARCH: "I_CONFIRM_LOCAL_PAID_RESEARCH",
  LOCAL_LIVE_RESEARCH_COST_LIMIT_USD: "0.15",
  TAVILY_API_KEY: "tavily-secret",
  DEEPSEEK_API_KEY: "deepseek-secret",
  BAILIAN_API_KEY: "bailian-secret",
  BAILIAN_WORKSPACE_ID: "workspace-secret",
};

describe("local development environment", () => {
  it("merges local Supabase values without replacing Provider credentials", () => {
    const environment = buildLocalEnvironment(providerEnvironment, {
      API_URL: "http://127.0.0.1:54321",
      PUBLISHABLE_KEY: "publishable-local",
      SECRET_KEY: "secret-local",
    });

    expect(environment).toMatchObject({
      ...providerEnvironment,
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-local",
      SUPABASE_SERVICE_ROLE_KEY: "secret-local",
      LOCAL_DEV_AUTH_ENABLED: "true",
      INNGEST_DEV: "1",
    });
  });

  it("falls back to the legacy local service role key", () => {
    expect(
      buildLocalEnvironment({}, {
        API_URL: "http://127.0.0.1:54321",
        PUBLISHABLE_KEY: "publishable-local",
        SERVICE_ROLE_KEY: "service-role-local",
      }).SUPABASE_SERVICE_ROLE_KEY,
    ).toBe("service-role-local");
  });

  it("rejects incomplete live configuration without exposing configured values", () => {
    const configuredSecret = "must-not-appear-in-errors";

    expect(() =>
      validateLocalLiveEnvironment({
        ...providerEnvironment,
        TAVILY_API_KEY: configuredSecret,
        DEEPSEEK_API_KEY: "",
      }),
    ).toThrow("LOCAL_LIVE_RESEARCH_ENV_INCOMPLETE: DEEPSEEK_API_KEY");

    try {
      validateLocalLiveEnvironment({
        ...providerEnvironment,
        TAVILY_API_KEY: configuredSecret,
        DEEPSEEK_API_KEY: "",
      });
    } catch (error) {
      expect(String(error)).not.toContain(configuredSecret);
    }
  });

  it("accepts the fixed local live research gate", () => {
    expect(validateLocalLiveEnvironment(providerEnvironment)).toEqual({
      costLimitUsd: 0.15,
    });
  });

  it("serializes values so Node can parse them without losing special characters", () => {
    const serialized = serializeEnvironment({
      SIMPLE: "value",
      COMPLEX: "spaces # quotes \" dollar $ and newline\n",
    });

    expect(parseEnv(serialized)).toEqual({
      SIMPLE: "value",
      COMPLEX: "spaces # quotes \" dollar $ and newline\n",
    });
    expect(serialized).not.toContain("undefined");
  });

  it("keeps local ports and file permissions stable", () => {
    expect(localDevelopmentConstants).toMatchObject({
      appHost: "127.0.0.1",
      appPort: 3218,
      inngestPort: 8288,
      environmentFileMode: 0o600,
    });
  });

  it("requires the repository Node.js major version", () => {
    expect(() => assertSupportedNodeVersion("v22.22.1")).not.toThrow();
    expect(() => assertSupportedNodeVersion("v20.20.0")).toThrow(
      "LOCAL_DEVELOPMENT_NODE_VERSION_UNSUPPORTED: expected Node.js 22",
    );
  });

  it("rejects an occupied local service port", async () => {
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      server.close();
      throw new Error("TEST_PORT_UNAVAILABLE");
    }

    try {
      await expect(
        assertPortAvailable({ host: "127.0.0.1", port: address.port }),
      ).rejects.toThrow(`LOCAL_DEVELOPMENT_PORT_IN_USE: ${address.port}`);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("writes local environment files with owner-only permissions", async () => {
    const directory = await mkdtemp(join(tmpdir(), "evidence-graph-local-env-"));
    const environmentPath = join(directory, ".env.local");

    try {
      await writeEnvironmentFile(environmentPath, providerEnvironment);

      const file = await lstat(environmentPath);
      expect(file.mode & 0o777).toBe(0o600);
      expect(parseEnv(await readFile(environmentPath, "utf8"))).toEqual(
        providerEnvironment,
      );
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("refuses to replace a symlinked local environment file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "evidence-graph-local-env-"));
    const targetPath = join(directory, "target");
    const environmentPath = join(directory, ".env.local");

    try {
      await writeFile(targetPath, "DO_NOT_REPLACE=true\n", "utf8");
      await symlink(targetPath, environmentPath);

      await expect(
        writeEnvironmentFile(environmentPath, providerEnvironment),
      ).rejects.toThrow("LOCAL_DEVELOPMENT_ENV_SYMLINK_REJECTED");
      expect(await readFile(targetPath, "utf8")).toBe("DO_NOT_REPLACE=true\n");
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("exposes one local command with a pinned Inngest CLI", async () => {
    const packageJson = JSON.parse(
      await readFile(join(process.cwd(), "package.json"), "utf8"),
    ) as {
      scripts: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(packageJson.scripts["dev:local"]).toBe(
      "node scripts/local-development.mjs",
    );
    expect(packageJson.devDependencies["inngest-cli"]).toBe("1.38.1");
  });
});
