import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const scriptPath = join(process.cwd(), "scripts/check-provider-boundary.mjs");
const temporaryDirectories: string[] = [];

const createWorkspace = async (providerSource: string) => {
  const directory = await mkdtemp(
    join(tmpdir(), "evidence-provider-boundary-"),
  );
  temporaryDirectories.push(directory);
  await mkdir(join(directory, "src/providers"), { recursive: true });
  await writeFile(
    join(directory, "src/providers/live-provider.ts"),
    providerSource,
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
});
