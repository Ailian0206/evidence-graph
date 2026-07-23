import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const smokeScript = join(process.cwd(), "scripts/smoke-production.mjs");
let temporaryDirectory: string;
let preloadScript: string;
let requestLog: string;

beforeEach(async () => {
  temporaryDirectory = await mkdtemp(
    join(tmpdir(), "evidence-production-smoke-"),
  );
  preloadScript = join(temporaryDirectory, "mock-fetch.mjs");
  requestLog = join(temporaryDirectory, "requests.jsonl");

  await writeFile(
    preloadScript,
    `
import { appendFileSync } from "node:fs";

globalThis.fetch = async (input, init = {}) => {
  const url = input instanceof URL
    ? input
    : new URL(typeof input === "string" ? input : input.url);
  const method = init.method ?? "GET";
  appendFileSync(process.env.SMOKE_FETCH_LOG, JSON.stringify({ method, path: url.pathname }) + "\\n");

  if (url.pathname === "/zh") {
    return new Response("home", {
      status: 200,
      headers: {
        "content-security-policy": "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
        "permissions-policy": "camera=(), microphone=(), geolocation=()",
        "referrer-policy": "strict-origin-when-cross-origin",
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
      },
    });
  }

  if (url.pathname === "/zh/app/research/demo") {
    return new Response("demo", { status: 200 });
  }

  if (url.pathname === "/zh/app") {
    return new Response(null, {
      status: 307,
      headers: { location: "/zh/auth/login?next=%2Fzh%2Fapp" },
    });
  }

  if (url.pathname === "/api/inngest") {
    return new Response("invalid signature", { status: 401 });
  }

  return new Response("unexpected request", { status: 500 });
};
`,
  );
});

afterEach(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

const runSmoke = (environment: Record<string, string> = {}) =>
  spawnSync(process.execPath, ["--import", preloadScript, smokeScript], {
    encoding: "utf8",
    env: {
      ...process.env,
      SMOKE_FETCH_LOG: requestLog,
      ...environment,
    },
  });

const readRequests = async () =>
  (await readFile(requestLog, "utf8"))
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { method: string; path: string });

const expectNoRequests = async () => {
  await expect(readFile(requestLog, "utf8")).rejects.toMatchObject({
    code: "ENOENT",
  });
};

describe("production smoke gate", () => {
  it("exits before network access without the explicit confirmation token", async () => {
    const result = runSmoke({
      PRODUCTION_BASE_URL: "https://evidence.example.com",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("PRODUCTION_SMOKE_NOT_CONFIRMED");
    await expectNoRequests();
  });

  it.each([
    "http://evidence.example.com",
    "https://localhost:3000",
    "https://127.0.0.2",
    "https://[::1]",
  ])("rejects a non-production base URL: %s", async (baseUrl) => {
    const result = runSmoke({
      ALLOW_PRODUCTION_SMOKE: "YES_I_ACCEPT_REAL_WRITES",
      PRODUCTION_BASE_URL: baseUrl,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("PRODUCTION_BASE_URL_INVALID");
    await expectNoRequests();
  });

  it("runs only the default read-only and rejection checks", async () => {
    const result = runSmoke({
      ALLOW_PRODUCTION_SMOKE: "YES_I_ACCEPT_REAL_WRITES",
      PRODUCTION_BASE_URL: "https://evidence.example.com",
    });

    expect(result.status, result.stderr).toBe(0);
    expect(await readRequests()).toEqual([
      { method: "GET", path: "/zh" },
      { method: "GET", path: "/zh/app/research/demo" },
      { method: "GET", path: "/zh/app" },
      { method: "POST", path: "/api/inngest" },
    ]);
    expect(result.stdout).toContain("生产冒烟检查通过");
    expect(result.stdout).toContain("付费 Provider：未执行（专用冒烟上限 0.10 USD）");
  });
});
