import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectRefPattern = /^[a-z0-9]+$/;

class HostedDatabaseGateError extends Error {
  constructor(code) {
    super(code);
    this.name = "HostedDatabaseGateError";
  }
}

const fail = (code) => {
  throw new HostedDatabaseGateError(code);
};

export const assertLinkedProjectRef = ({
  allowedProjectRef,
  linkedProjectRef,
}) => {
  const allowed = allowedProjectRef?.trim();
  const linked = linkedProjectRef?.trim();

  if (!allowed || !projectRefPattern.test(allowed)) {
    fail("HOSTED_SUPABASE_PROJECT_REF_MISSING");
  }

  if (!linked || !projectRefPattern.test(linked)) {
    fail("HOSTED_SUPABASE_LINK_MISSING");
  }

  if (allowed !== linked) {
    fail("HOSTED_SUPABASE_LINK_MISMATCH");
  }

  return linked;
};

export const createHostedDatabaseCommands = () => [
  ["test", "db", "--linked"],
  ["db", "lint", "--linked", "--level", "warning"],
];

const readLinkedProjectRef = async () => {
  try {
    return await readFile(
      join(projectRoot, "supabase", ".temp", "project-ref"),
      "utf8",
    );
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      fail("HOSTED_SUPABASE_LINK_MISSING");
    }

    fail("HOSTED_SUPABASE_LINK_READ_FAILED");
  }
};

const runSupabaseCommand = (args) =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      join(projectRoot, "node_modules", ".bin", "supabase"),
      args,
      {
        cwd: projectRoot,
        stdio: "inherit",
      },
    );

    child.once("error", () => {
      rejectPromise(new HostedDatabaseGateError("HOSTED_DATABASE_GATE_FAILED"));
    });
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(
        new HostedDatabaseGateError(
          signal
            ? "HOSTED_DATABASE_GATE_INTERRUPTED"
            : "HOSTED_DATABASE_GATE_FAILED",
        ),
      );
    });
  });

const main = async () => {
  assertLinkedProjectRef({
    allowedProjectRef:
      process.env.LOCAL_DEVELOPMENT_SUPABASE_PROJECT_REF,
    linkedProjectRef: await readLinkedProjectRef(),
  });

  for (const args of createHostedDatabaseCommands()) {
    await runSupabaseCommand(args);
  }

  console.log("[hosted-db] ready");
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    const message =
      error instanceof HostedDatabaseGateError
        ? error.message
        : "HOSTED_DATABASE_GATE_FAILED";
    console.error(`[hosted-db] ${message}`);
    process.exitCode = 1;
  });
}
