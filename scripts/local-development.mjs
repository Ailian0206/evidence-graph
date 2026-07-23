import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  chmod,
  lstat,
  open,
  readFile,
  rename,
  unlink,
} from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { promisify, parseEnv } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const localDevelopmentConstants = Object.freeze({
  appHost: "127.0.0.1",
  appPort: 3218,
  inngestHost: "127.0.0.1",
  inngestPort: 8288,
  environmentFileMode: 0o600,
  maximumCostLimitUsd: 0.15,
});

class LocalDevelopmentError extends Error {
  constructor(code) {
    super(code);
    this.name = "LocalDevelopmentError";
  }
}

const fail = (code) => {
  throw new LocalDevelopmentError(code);
};

const requiredStatus = (status, key) => {
  const value = status[key];

  if (typeof value !== "string" || value.trim() === "") {
    fail(`LOCAL_SUPABASE_STATUS_INCOMPLETE: ${key}`);
  }

  return value;
};

export const buildLocalEnvironment = (existing, status) => ({
  ...existing,
  NEXT_PUBLIC_SUPABASE_URL: requiredStatus(status, "API_URL"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: requiredStatus(
    status,
    "PUBLISHABLE_KEY",
  ),
  SUPABASE_SERVICE_ROLE_KEY:
    typeof status.SECRET_KEY === "string" && status.SECRET_KEY.trim() !== ""
      ? status.SECRET_KEY
      : requiredStatus(status, "SERVICE_ROLE_KEY"),
  LOCAL_DEV_AUTH_ENABLED: "true",
  INNGEST_DEV: "1",
});

const requireEnvironmentValue = (environment, name, expected) => {
  const value = environment[name];

  if (
    typeof value !== "string" ||
    value.trim() === "" ||
    (expected !== undefined && value !== expected)
  ) {
    fail(`LOCAL_LIVE_RESEARCH_ENV_INCOMPLETE: ${name}`);
  }

  return value;
};

export const validateLocalLiveEnvironment = (environment) => {
  requireEnvironmentValue(environment, "RESEARCH_PROVIDER_MODE", "live");
  requireEnvironmentValue(
    environment,
    "ALLOW_LOCAL_LIVE_RESEARCH",
    "I_CONFIRM_LOCAL_PAID_RESEARCH",
  );

  const rawCostLimit = requireEnvironmentValue(
    environment,
    "LOCAL_LIVE_RESEARCH_COST_LIMIT_USD",
  );
  const costLimitUsd = Number(rawCostLimit);

  if (
    !Number.isFinite(costLimitUsd) ||
    costLimitUsd <= 0 ||
    costLimitUsd > localDevelopmentConstants.maximumCostLimitUsd
  ) {
    fail("LOCAL_LIVE_RESEARCH_COST_LIMIT_INVALID");
  }

  for (const name of [
    "TAVILY_API_KEY",
    "DEEPSEEK_API_KEY",
    "BAILIAN_API_KEY",
    "BAILIAN_WORKSPACE_ID",
  ]) {
    requireEnvironmentValue(environment, name);
  }

  return { costLimitUsd };
};

const serializeValue = (name, value) => {
  if (!value.includes("'")) {
    return `'${value}'`;
  }

  if (!value.includes('"')) {
    return `"${value}"`;
  }

  fail(`LOCAL_DEVELOPMENT_ENV_VALUE_UNSUPPORTED: ${name}`);
};

export const serializeEnvironment = (environment) =>
  `${Object.entries(environment)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        fail(`LOCAL_DEVELOPMENT_ENV_NAME_INVALID: ${name}`);
      }

      return `${name}=${serializeValue(name, String(value))}`;
    })
    .join("\n")}\n`;

const inspectEnvironmentPath = async (environmentPath) => {
  try {
    return await lstat(environmentPath);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return null;
    }

    fail("LOCAL_DEVELOPMENT_ENV_INSPECTION_FAILED");
  }
};

export const writeEnvironmentFile = async (environmentPath, environment) => {
  const existing = await inspectEnvironmentPath(environmentPath);

  if (existing?.isSymbolicLink()) {
    fail("LOCAL_DEVELOPMENT_ENV_SYMLINK_REJECTED");
  }

  const temporaryPath = `${environmentPath}.${process.pid}.${randomUUID()}.tmp`;
  let file;

  try {
    file = await open(
      temporaryPath,
      "wx",
      localDevelopmentConstants.environmentFileMode,
    );
    await file.writeFile(serializeEnvironment(environment), "utf8");
    await file.sync();
    await file.close();
    file = undefined;
    await rename(temporaryPath, environmentPath);
    await chmod(environmentPath, localDevelopmentConstants.environmentFileMode);
  } catch (error) {
    await file?.close().catch(() => undefined);
    await unlink(temporaryPath).catch(() => undefined);

    if (error instanceof LocalDevelopmentError) {
      throw error;
    }

    fail("LOCAL_DEVELOPMENT_ENV_WRITE_FAILED");
  }
};

export const assertSupportedNodeVersion = (version) => {
  const major = Number(/^v?(\d+)\./.exec(version)?.[1]);

  if (major !== 22) {
    fail("LOCAL_DEVELOPMENT_NODE_VERSION_UNSUPPORTED: expected Node.js 22");
  }
};

export const assertPortAvailable = ({ host, port }) =>
  new Promise((resolvePromise, rejectPromise) => {
    const server = createServer();

    server.unref();
    server.once("error", (error) => {
      if (error && typeof error === "object" && error.code === "EADDRINUSE") {
        rejectPromise(
          new LocalDevelopmentError(`LOCAL_DEVELOPMENT_PORT_IN_USE: ${port}`),
        );
        return;
      }

      rejectPromise(
        new LocalDevelopmentError(
          `LOCAL_DEVELOPMENT_PORT_CHECK_FAILED: ${port}`,
        ),
      );
    });
    server.listen(port, host, () => {
      server.close((error) => {
        if (error) {
          rejectPromise(
            new LocalDevelopmentError(
              `LOCAL_DEVELOPMENT_PORT_CHECK_FAILED: ${port}`,
            ),
          );
          return;
        }

        resolvePromise();
      });
    });
  });

const readExistingEnvironment = async (environmentPath) => {
  const existing = await inspectEnvironmentPath(environmentPath);

  if (!existing) {
    return {};
  }

  if (existing.isSymbolicLink()) {
    fail("LOCAL_DEVELOPMENT_ENV_SYMLINK_REJECTED");
  }

  try {
    return parseEnv(await readFile(environmentPath, "utf8"));
  } catch {
    fail("LOCAL_DEVELOPMENT_ENV_READ_FAILED");
  }
};

const localBinary = (name) => join(projectRoot, "node_modules", ".bin", name);

const runPrivateCommand = async (command, args, failureCode) => {
  try {
    return await execFileAsync(command, args, {
      cwd: projectRoot,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch {
    fail(failureCode);
  }
};

const prepareEnvironment = async () => {
  const environmentPath = join(projectRoot, ".env.local");
  const existingEnvironment = await readExistingEnvironment(environmentPath);
  const supabase = localBinary("supabase");

  await runPrivateCommand(
    supabase,
    ["start"],
    "LOCAL_SUPABASE_START_FAILED",
  );
  const { stdout } = await runPrivateCommand(
    supabase,
    ["status", "--output", "json"],
    "LOCAL_SUPABASE_STATUS_FAILED",
  );

  let status;
  try {
    status = JSON.parse(stdout);
  } catch {
    fail("LOCAL_SUPABASE_STATUS_INVALID");
  }

  const environment = buildLocalEnvironment(existingEnvironment, status);
  validateLocalLiveEnvironment(environment);
  await writeEnvironmentFile(environmentPath, environment);

  return environment;
};

const waitForChild = (child, name) =>
  new Promise((resolvePromise, rejectPromise) => {
    child.once("error", () => {
      rejectPromise(
        new LocalDevelopmentError(
          `LOCAL_DEVELOPMENT_PROCESS_START_FAILED: ${name}`,
        ),
      );
    });
    child.once("exit", (code, signal) => {
      resolvePromise({ code, name, signal });
    });
  });

const stopChild = (child) => {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
  }
};

const runServices = async (environment) => {
  const childEnvironment = { ...process.env, ...environment };
  const next = spawn(
    localBinary("next"),
    [
      "dev",
      "--hostname",
      localDevelopmentConstants.appHost,
      "--port",
      String(localDevelopmentConstants.appPort),
    ],
    { cwd: projectRoot, env: childEnvironment, stdio: "inherit" },
  );
  const inngest = spawn(
    localBinary("inngest-cli"),
    [
      "dev",
      "--no-discovery",
      "--host",
      localDevelopmentConstants.inngestHost,
      "--port",
      String(localDevelopmentConstants.inngestPort),
      "--sdk-url",
      `http://${localDevelopmentConstants.appHost}:${localDevelopmentConstants.appPort}/api/inngest`,
    ],
    { cwd: projectRoot, env: childEnvironment, stdio: "inherit" },
  );

  const children = [next, inngest];
  const stopServices = () => children.forEach(stopChild);
  process.once("SIGINT", stopServices);
  process.once("SIGTERM", stopServices);

  try {
    const result = await Promise.race([
      waitForChild(next, "next"),
      waitForChild(inngest, "inngest"),
    ]);
    stopServices();
    process.exitCode = result.code ?? (result.signal ? 0 : 1);
  } finally {
    process.removeListener("SIGINT", stopServices);
    process.removeListener("SIGTERM", stopServices);
    stopServices();
  }
};

const main = async () => {
  assertSupportedNodeVersion(process.version);
  const environment = await prepareEnvironment();

  await Promise.all([
    assertPortAvailable({
      host: localDevelopmentConstants.appHost,
      port: localDevelopmentConstants.appPort,
    }),
    assertPortAvailable({
      host: localDevelopmentConstants.inngestHost,
      port: localDevelopmentConstants.inngestPort,
    }),
  ]);

  console.log(
    `[local-dev] 本地研究环境 / Local research workspace: http://${localDevelopmentConstants.appHost}:${localDevelopmentConstants.appPort}/zh/auth/login`,
  );
  console.log(
    `[local-dev] Inngest: http://${localDevelopmentConstants.inngestHost}:${localDevelopmentConstants.inngestPort}`,
  );
  await runServices(environment);
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    const message =
      error instanceof LocalDevelopmentError
        ? error.message
        : "LOCAL_DEVELOPMENT_START_FAILED";
    console.error(`[local-dev] ${message}`);
    process.exitCode = 1;
  });
}
