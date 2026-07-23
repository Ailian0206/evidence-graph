import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const scriptPath = join(process.cwd(), "scripts/check-provider-boundary.mjs");
const temporaryDirectories: string[] = [];

const createWorkspace = async (
  files: Record<string, string> | string,
) => {
  const directory = await mkdtemp(
    join(tmpdir(), "evidence-provider-boundary-"),
  );
  temporaryDirectories.push(directory);
  const workspaceFiles =
    typeof files === "string"
      ? { "src/providers/live-provider.ts": files }
      : files;

  await Promise.all(
    Object.entries(workspaceFiles).map(async ([path, source]) => {
      const filePath = join(directory, path);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, source);
    }),
  );
  return directory;
};

const runBoundaryCheck = (directory: string) =>
  spawnSync(process.execPath, [scriptPath], {
    cwd: directory,
    encoding: "utf8",
  });

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("Provider boundary check", () => {
  it("rejects network calls in non-fixture Provider modules", async () => {
    const directory = await createWorkspace(
      'export const search = () => fetch("https://provider.example.com");\n',
    );

    const result = runBoundaryCheck(directory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("network Provider implementation");
  });

  it("requires live Provider and runtime modules to be server-only", async () => {
    const directory = await createWorkspace({
      "src/providers/live/tavily-provider.ts": "export const live = true;\n",
      "src/providers/runtime.ts": "export const runtime = true;\n",
    });

    const result = runBoundaryCheck(directory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "src/providers/live/tavily-provider.ts: live Provider module must import server-only",
    );
    expect(result.stderr).toContain(
      "src/providers/runtime.ts: Provider runtime module must import server-only",
    );
  });

  it("rejects unreviewed network modules inside the live Provider directory", async () => {
    const directory = await createWorkspace({
      "src/providers/live/unreviewed-provider.ts":
        'import "server-only";\nexport const call = () => fetch("https://provider.example.com");\n',
    });

    const result = runBoundaryCheck(directory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("network Provider implementation is not allowed");
  });

  it.each([
    [
      "an imported HTTP helper",
      'import { requestProviderJson } from "./live/provider-http";\nexport const call = () => requestProviderJson({});\n',
    ],
    [
      "an aliased global fetch",
      'const send = globalThis.fetch;\nexport const call = () => send("https://provider.example.com");\n',
    ],
    [
      "node:http",
      'import http from "node:http";\nexport const call = () => http.get("http://provider.example.com");\n',
    ],
    [
      "node:https",
      'import https from "node:https";\nexport const call = () => https.get("https://provider.example.com");\n',
    ],
  ])("rejects %s in an unreviewed Provider module", async (_capability, source) => {
    const directory = await createWorkspace({
      "src/providers/unreviewed-provider.ts": source,
    });

    const result = runBoundaryCheck(directory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("network Provider implementation is not allowed");
  });

  it("rejects an imported default fetch with a dynamic URL", async () => {
    const directory = await createWorkspace({
      "src/providers/unreviewed-provider.ts":
        'import { defaultProviderFetch as send } from "./live/provider-http";\nconst endpoint = process.env.PROVIDER_URL;\nexport const call = () => send(endpoint);\n',
    });

    const result = runBoundaryCheck(directory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("network Provider implementation is not allowed");
  });

  it("rejects dynamic fetch in the reviewed HTTP helper", async () => {
    const directory = await createWorkspace({
      "src/providers/live/provider-http.ts":
        'import "server-only";\nconst endpoint = process.env.PROVIDER_URL;\nexport const call = () => fetch(endpoint);\n',
    });

    const result = runBoundaryCheck(directory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("network Provider implementation is not allowed");
  });

  it("rejects generic public Provider variables in client modules", async () => {
    const directory = await createWorkspace({
      "src/client-provider.ts":
        '"use client";\nexport const providerToken = process.env.NEXT_PUBLIC_RESEARCH_PROVIDER_TOKEN;\n',
    });

    const result = runBoundaryCheck(directory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("public Provider environment variable");
  });

  it.each([
    "src/providers/live/tavily-provider.ts",
    "src/providers/live/deepseek-language-model.ts",
    "src/providers/live/bailian-embedding-provider.ts",
  ])("rejects an unknown endpoint in reviewed live module %s", async (path) => {
    const directory = await createWorkspace({
      [path]:
        'import "server-only";\nexport const call = () => fetch("https://unknown-provider.example.com/v1");\n',
    });

    const result = runBoundaryCheck(directory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unapproved live Provider endpoint");
  });

  it.each([
    "src/providers/live/provider-http.ts",
    "src/providers/live/model-prompts.ts",
  ])("rejects endpoints in reviewed helper module %s", async (path) => {
    const directory = await createWorkspace({
      [path]:
        'import "server-only";\nexport const endpoint = "https://unknown-provider.example.com/v1";\n',
    });

    const result = runBoundaryCheck(directory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unapproved live Provider endpoint");
  });

  it("rejects an insecure HTTP endpoint in a reviewed Provider module", async () => {
    const directory = await createWorkspace({
      "src/providers/live/tavily-provider.ts":
        'import "server-only";\nexport const endpoint = "http://unknown-provider.example.com/v1";\n',
    });

    const result = runBoundaryCheck(directory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unapproved live Provider endpoint");
  });

  it("rejects subdomains of fixed live Provider endpoints", async () => {
    const directory = await createWorkspace({
      "src/providers/live/tavily-provider.ts":
        'import "server-only";\nexport const call = () => fetch("https://evil.api.tavily.com/v1");\n',
    });

    const result = runBoundaryCheck(directory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unapproved live Provider endpoint");
  });
});
