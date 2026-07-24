import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const loadHostedDatabaseGate = () =>
  import("../../scripts/hosted-database-gate.mjs");

describe("hosted database gate", () => {
  it("requires the linked project to match the explicit allow-list", async () => {
    const { assertLinkedProjectRef } = await loadHostedDatabaseGate();

    expect(
      assertLinkedProjectRef({
        allowedProjectRef: "dibngceljmdkcgrzxubx",
        linkedProjectRef: "dibngceljmdkcgrzxubx\n",
      }),
    ).toBe("dibngceljmdkcgrzxubx");
    expect(() =>
      assertLinkedProjectRef({
        allowedProjectRef: "dibngceljmdkcgrzxubx",
        linkedProjectRef: "otherprojectref",
      }),
    ).toThrow("HOSTED_SUPABASE_LINK_MISMATCH");
  });

  it("allows only linked transaction tests and lint", async () => {
    const { createHostedDatabaseCommands } = await loadHostedDatabaseGate();

    expect(createHostedDatabaseCommands()).toEqual([
      ["test", "db", "--linked"],
      ["db", "lint", "--linked", "--level", "warning"],
    ]);
  });

  it("keeps hosted and CI database responsibilities separate", async () => {
    const [packageSource, workflow] = await Promise.all([
      readFile(join(process.cwd(), "package.json"), "utf8"),
      readFile(join(process.cwd(), ".github/workflows/ci.yml"), "utf8"),
    ]);
    const packageJson = JSON.parse(packageSource) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["test:db"]).toBe("npm run test:db:hosted");
    expect(packageJson.scripts["test:db:hosted"]).toBe(
      "node --env-file-if-exists=.env.local scripts/hosted-database-gate.mjs",
    );
    expect(packageJson.scripts["test:db:hosted"]).not.toContain("--local");
    expect(packageJson.scripts["test:db:hosted"]).not.toContain("db reset");
    expect(packageJson.scripts["test:db:ci"]).toContain(
      "supabase db reset --local",
    );
    expect(packageJson.scripts["test:managed"]).toContain(
      "npm run test:db:hosted",
    );
    expect(workflow).toContain("run: npm run test:db:ci");
  });
});
