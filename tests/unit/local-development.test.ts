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

import { describe, expect, it } from "vitest";

import {
  assertPortAvailable,
  assertSupportedNodeVersion,
  createLocalServiceSpecs,
  localDevelopmentConstants,
  parseLocalDevelopmentArguments,
  readHostedSupabaseProjectRef,
  secureEnvironmentFile,
  validateHostedDevelopmentEnvironment,
} from "../../scripts/local-development.mjs";

const hostedEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL:
    "https://dibngceljmdkcgrzxubx.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
  LOCAL_DEVELOPMENT_SUPABASE_PROJECT_REF: "dibngceljmdkcgrzxubx",
};

const liveEnvironment = {
  ...hostedEnvironment,
  RESEARCH_PROVIDER_MODE: "live",
  ALLOW_LOCAL_LIVE_RESEARCH: "I_CONFIRM_LOCAL_PAID_RESEARCH",
  LOCAL_LIVE_RESEARCH_COST_LIMIT_USD: "0.15",
  TAVILY_API_KEY: "tavily-secret",
  DEEPSEEK_API_KEY: "deepseek-secret",
  BAILIAN_API_KEY: "bailian-secret",
  BAILIAN_WORKSPACE_ID: "workspace-secret",
};

describe("hosted local development environment", () => {
  it("accepts only an explicitly allowed hosted Supabase project", () => {
    expect(
      readHostedSupabaseProjectRef(
        "https://dibngceljmdkcgrzxubx.supabase.co",
      ),
    ).toBe("dibngceljmdkcgrzxubx");

    expect(
      validateHostedDevelopmentEnvironment({
        environment: hostedEnvironment,
        profile: "fixture",
      }),
    ).toEqual({
      profile: "fixture",
      projectRef: "dibngceljmdkcgrzxubx",
    });
  });

  it.each([
    "http://127.0.0.1:54321",
    "https://example.com",
    "not-a-url",
  ])("rejects non-hosted Supabase URL %s", (url) => {
    expect(() => readHostedSupabaseProjectRef(url)).toThrow(
      "HOSTED_SUPABASE_URL_INVALID",
    );
  });

  it("rejects a hosted project that does not match the explicit allow-list", () => {
    expect(() =>
      validateHostedDevelopmentEnvironment({
        environment: {
          ...hostedEnvironment,
          LOCAL_DEVELOPMENT_SUPABASE_PROJECT_REF: "otherprojectref",
        },
        profile: "fixture",
      }),
    ).toThrow("HOSTED_SUPABASE_PROJECT_REF_MISMATCH");
  });

  it("validates live Provider configuration without exposing secrets", () => {
    expect(
      validateHostedDevelopmentEnvironment({
        environment: liveEnvironment,
        profile: "live",
      }),
    ).toEqual({
      profile: "live",
      projectRef: "dibngceljmdkcgrzxubx",
    });

    const configuredSecret = "must-not-appear-in-errors";
    try {
      validateHostedDevelopmentEnvironment({
        environment: {
          ...liveEnvironment,
          TAVILY_API_KEY: configuredSecret,
          DEEPSEEK_API_KEY: "",
        },
        profile: "live",
      });
      throw new Error("EXPECTED_VALIDATION_FAILURE");
    } catch (error) {
      expect(String(error)).toContain(
        "LOCAL_LIVE_RESEARCH_ENV_INCOMPLETE: DEEPSEEK_API_KEY",
      );
      expect(String(error)).not.toContain(configuredSecret);
    }
  });

  it("parses a fixed Provider profile and check-only mode", () => {
    expect(
      parseLocalDevelopmentArguments(["--profile=fixture", "--check"]),
    ).toEqual({ checkOnly: true, profile: "fixture" });
    expect(parseLocalDevelopmentArguments(["--profile=live"])).toEqual({
      checkOnly: false,
      profile: "live",
    });
    expect(() =>
      parseLocalDevelopmentArguments(["--profile=unknown"]),
    ).toThrow("LOCAL_DEVELOPMENT_PROFILE_INVALID");
    expect(() => parseLocalDevelopmentArguments(["--verbose"])).toThrow(
      "LOCAL_DEVELOPMENT_ARGUMENT_INVALID",
    );
  });

  it("uses fixed ports and the minimum viable persistent Inngest workers", () => {
    const projectRoot = "/tmp/evidence-graph";
    const specs = createLocalServiceSpecs({ profile: "live", projectRoot });

    expect(localDevelopmentConstants).toMatchObject({
      appHost: "127.0.0.1",
      appPort: 3218,
      inngestHost: "127.0.0.1",
      inngestPort: 8288,
      environmentFileMode: 0o600,
    });
    expect(specs).toEqual([
      expect.objectContaining({
        name: "next",
        cwd: projectRoot,
        args: ["dev", "--hostname", "127.0.0.1", "--port", "3218"],
      }),
      expect.objectContaining({
        name: "inngest",
        cwd: join(projectRoot, "output", "inngest"),
        args: [
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
        ],
      }),
    ]);
  });

  it("does not retain a Supabase or Docker startup path", async () => {
    const source = await readFile(
      join(process.cwd(), "scripts/local-development.mjs"),
      "utf8",
    );
    const packageJson = JSON.parse(
      await readFile(join(process.cwd(), "package.json"), "utf8"),
    ) as {
      scripts: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(source).not.toContain('localBinary("supabase")');
    expect(source).not.toContain("supabase status");
    expect(source).not.toContain("docker");
    expect(packageJson.scripts["dev:local"]).toContain("--profile=fixture");
    expect(packageJson.scripts["dev:local:live"]).toContain("--profile=live");
    expect(packageJson.devDependencies["inngest-cli"]).toBe("1.38.1");
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

  it("tightens the environment file without rewriting its contents", async () => {
    const directory = await mkdtemp(join(tmpdir(), "evidence-graph-env-"));
    const environmentPath = join(directory, ".env.local");
    const contents = "SECRET=unchanged\n";

    try {
      await writeFile(environmentPath, contents, { mode: 0o644 });
      await secureEnvironmentFile(environmentPath);

      const file = await lstat(environmentPath);
      expect(file.mode & 0o777).toBe(0o600);
      expect(await readFile(environmentPath, "utf8")).toBe(contents);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("rejects a symlinked environment file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "evidence-graph-env-"));
    const targetPath = join(directory, "target");
    const environmentPath = join(directory, ".env.local");

    try {
      await writeFile(targetPath, "SECRET=unchanged\n", "utf8");
      await symlink(targetPath, environmentPath);

      await expect(secureEnvironmentFile(environmentPath)).rejects.toThrow(
        "LOCAL_DEVELOPMENT_ENV_SYMLINK_REJECTED",
      );
      expect(await readFile(targetPath, "utf8")).toBe("SECRET=unchanged\n");
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
