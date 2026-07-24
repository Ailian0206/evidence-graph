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
    const {
      createHostedDatabaseCommands,
      createPoolerDatabaseUrl,
      isReservedBenchmarkAddress,
    } = await loadHostedDatabaseGate();

    expect(createHostedDatabaseCommands()).toEqual([
      ["test", "db", "--linked"],
      ["db", "lint", "--linked", "--level", "warning"],
    ]);

    expect(isReservedBenchmarkAddress("198.18.0.1")).toBe(true);
    expect(isReservedBenchmarkAddress("198.19.255.255")).toBe(true);
    expect(isReservedBenchmarkAddress("198.20.0.1")).toBe(false);
    expect(isReservedBenchmarkAddress("127.0.0.1")).toBe(false);

    const databaseUrl = createPoolerDatabaseUrl({
      poolerUrl:
        "postgresql://postgres.dibngceljmdkcgrzxubx@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres",
      projectRef: "dibngceljmdkcgrzxubx",
      role: "cli_login_postgres",
    });

    expect(databaseUrl).toBe(
      "postgresql://cli_login_postgres.dibngceljmdkcgrzxubx@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres",
    );
    expect(databaseUrl).not.toContain("password");
    expect(createHostedDatabaseCommands({ databaseUrl })).toEqual([
      ["test", "db", "--db-url", databaseUrl],
      ["db", "lint", "--db-url", databaseUrl, "--level", "warning"],
    ]);
    expect(() =>
      createPoolerDatabaseUrl({
        poolerUrl:
          "postgresql://postgres.otherprojectref@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres",
        projectRef: "dibngceljmdkcgrzxubx",
        role: "cli_login_postgres",
      }),
    ).toThrow("HOSTED_SUPABASE_POOLER_INVALID");
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
