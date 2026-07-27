import { execFile, spawn } from "node:child_process";
import { lookup } from "node:dns";
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

export const isReservedBenchmarkAddress = (address) => {
  const octets = address.split(".").map(Number);

  return (
    octets.length === 4 &&
    octets.every(
      (octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255,
    ) &&
    octets[0] === 198 &&
    (octets[1] === 18 || octets[1] === 19)
  );
};

export const createPoolerDatabaseUrl = ({ poolerUrl, projectRef, role }) => {
  let url;

  try {
    url = new URL(poolerUrl.trim());
  } catch {
    fail("HOSTED_SUPABASE_POOLER_INVALID");
  }

  if (
    (url.protocol !== "postgresql:" && url.protocol !== "postgres:") ||
    !/^[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname) ||
    url.username !== `postgres.${projectRef}` ||
    !/^[A-Za-z0-9_]+$/.test(role)
  ) {
    fail("HOSTED_SUPABASE_POOLER_INVALID");
  }

  url.username = `${role}.${projectRef}`;
  url.password = "";

  return url.toString();
};

export const createHostedDatabaseCommands = ({ databaseUrl } = {}) => {
  const connectionArguments = databaseUrl
    ? ["--db-url", databaseUrl]
    : ["--linked"];

  return [
    ["test", "db", ...connectionArguments],
    ["db", "lint", ...connectionArguments, "--level", "warning"],
  ];
};

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

const readPoolerUrl = async () => {
  try {
    return await readFile(
      join(projectRoot, "supabase", ".temp", "pooler-url"),
      "utf8",
    );
  } catch {
    fail("HOSTED_SUPABASE_POOLER_MISSING");
  }
};

const lookupAddresses = (host) =>
  new Promise((resolvePromise) => {
    lookup(host, { all: true }, (error, addresses) => {
      resolvePromise(error ? [] : addresses.map(({ address }) => address));
    });
  });

const readKeychainAccessToken = () =>
  new Promise((resolvePromise, rejectPromise) => {
    execFile(
      "/usr/bin/security",
      [
        "find-generic-password",
        "-a",
        "supabase",
        "-s",
        "Supabase CLI",
        "-w",
      ],
      { encoding: "utf8" },
      (error, stdout) => {
        if (error || stdout.trim() === "") {
          rejectPromise(
            new HostedDatabaseGateError(
              "HOSTED_SUPABASE_ACCESS_TOKEN_MISSING",
            ),
          );
          return;
        }

        resolvePromise(stdout.trim());
      },
    );
  });

const readSupabaseAccessToken = async () => {
  const configured = process.env.SUPABASE_ACCESS_TOKEN?.trim();

  if (configured) {
    return configured;
  }

  if (process.platform !== "darwin") {
    fail("HOSTED_SUPABASE_ACCESS_TOKEN_MISSING");
  }

  return readKeychainAccessToken();
};

const createTemporaryPoolerConnection = async (projectRef) => {
  let response;

  try {
    response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/cli/login-role`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${await readSupabaseAccessToken()}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ read_only: false }),
        signal: AbortSignal.timeout(20_000),
      },
    );
  } catch {
    fail("HOSTED_SUPABASE_POOLER_AUTH_FAILED");
  }

  if (!response.ok) {
    fail("HOSTED_SUPABASE_POOLER_AUTH_FAILED");
  }

  let credentials;
  try {
    credentials = await response.json();
  } catch {
    fail("HOSTED_SUPABASE_POOLER_AUTH_FAILED");
  }

  if (
    !credentials ||
    typeof credentials.role !== "string" ||
    typeof credentials.password !== "string" ||
    credentials.password === ""
  ) {
    fail("HOSTED_SUPABASE_POOLER_AUTH_FAILED");
  }

  return {
    databaseUrl: createPoolerDatabaseUrl({
      poolerUrl: await readPoolerUrl(),
      projectRef,
      role: credentials.role,
    }),
    password: credentials.password,
  };
};

const runSupabaseCommand = (args, environment = {}) =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      join(projectRoot, "node_modules", ".bin", "supabase"),
      args,
      {
        cwd: projectRoot,
        env: { ...process.env, ...environment },
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
  const projectRef = assertLinkedProjectRef({
    allowedProjectRef:
      process.env.LOCAL_DEVELOPMENT_SUPABASE_PROJECT_REF,
    linkedProjectRef: await readLinkedProjectRef(),
  });

  const directAddresses = await lookupAddresses(
    `db.${projectRef}.supabase.co`,
  );
  const poolerConnection = directAddresses.some(isReservedBenchmarkAddress)
    ? await createTemporaryPoolerConnection(projectRef)
    : undefined;

  for (const args of createHostedDatabaseCommands({
    databaseUrl: poolerConnection?.databaseUrl,
  })) {
    await runSupabaseCommand(
      args,
      poolerConnection ? { PGPASSWORD: poolerConnection.password } : undefined,
    );
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
