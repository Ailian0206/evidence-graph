import { spawn } from "node:child_process";
import { chmod, lstat, mkdir } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

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

const requireEnvironmentValue = (environment, name, expected, errorCode) => {
  const value = environment[name];

  if (
    typeof value !== "string" ||
    value.trim() === "" ||
    (expected !== undefined && value !== expected)
  ) {
    fail(`${errorCode}: ${name}`);
  }

  return value.trim();
};

export const readHostedSupabaseProjectRef = (rawUrl) => {
  let url;

  try {
    url = new URL(rawUrl);
  } catch {
    fail("HOSTED_SUPABASE_URL_INVALID");
  }

  const match = /^([a-z0-9]+)\.supabase\.co$/.exec(url.hostname);

  if (url.protocol !== "https:" || url.port !== "" || !match) {
    fail("HOSTED_SUPABASE_URL_INVALID");
  }

  return match[1];
};

export const validateLocalLiveEnvironment = (environment) => {
  requireEnvironmentValue(
    environment,
    "RESEARCH_PROVIDER_MODE",
    "live",
    "LOCAL_LIVE_RESEARCH_ENV_INCOMPLETE",
  );
  requireEnvironmentValue(
    environment,
    "ALLOW_LOCAL_LIVE_RESEARCH",
    "I_CONFIRM_LOCAL_PAID_RESEARCH",
    "LOCAL_LIVE_RESEARCH_ENV_INCOMPLETE",
  );

  const rawCostLimit = requireEnvironmentValue(
    environment,
    "LOCAL_LIVE_RESEARCH_COST_LIMIT_USD",
    undefined,
    "LOCAL_LIVE_RESEARCH_ENV_INCOMPLETE",
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
    requireEnvironmentValue(
      environment,
      name,
      undefined,
      "LOCAL_LIVE_RESEARCH_ENV_INCOMPLETE",
    );
  }

  return { costLimitUsd };
};

export const validateHostedDevelopmentEnvironment = ({
  environment,
  profile,
}) => {
  const projectRef = readHostedSupabaseProjectRef(
    requireEnvironmentValue(
      environment,
      "NEXT_PUBLIC_SUPABASE_URL",
      undefined,
      "LOCAL_DEVELOPMENT_ENV_INCOMPLETE",
    ),
  );

  requireEnvironmentValue(
    environment,
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    undefined,
    "LOCAL_DEVELOPMENT_ENV_INCOMPLETE",
  );
  requireEnvironmentValue(
    environment,
    "SUPABASE_SERVICE_ROLE_KEY",
    undefined,
    "LOCAL_DEVELOPMENT_ENV_INCOMPLETE",
  );

  const allowedProjectRef = requireEnvironmentValue(
    environment,
    "LOCAL_DEVELOPMENT_SUPABASE_PROJECT_REF",
    undefined,
    "LOCAL_DEVELOPMENT_ENV_INCOMPLETE",
  );

  if (allowedProjectRef !== projectRef) {
    fail("HOSTED_SUPABASE_PROJECT_REF_MISMATCH");
  }

  if (profile === "live") {
    validateLocalLiveEnvironment(environment);
  } else if (profile !== "fixture") {
    fail("LOCAL_DEVELOPMENT_PROFILE_INVALID");
  }

  return { profile, projectRef };
};

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

export const secureEnvironmentFile = async (environmentPath) => {
  const file = await inspectEnvironmentPath(environmentPath);

  if (!file) {
    fail("LOCAL_DEVELOPMENT_ENV_MISSING");
  }

  if (file.isSymbolicLink()) {
    fail("LOCAL_DEVELOPMENT_ENV_SYMLINK_REJECTED");
  }

  if (!file.isFile()) {
    fail("LOCAL_DEVELOPMENT_ENV_INVALID");
  }

  try {
    await chmod(environmentPath, localDevelopmentConstants.environmentFileMode);
  } catch {
    fail("LOCAL_DEVELOPMENT_ENV_PERMISSION_FAILED");
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

export const parseLocalDevelopmentArguments = (argumentsList) => {
  let checkOnly = false;
  let profile;

  for (const argument of argumentsList) {
    if (argument === "--check") {
      checkOnly = true;
      continue;
    }

    if (argument.startsWith("--profile=")) {
      if (profile !== undefined) {
        fail("LOCAL_DEVELOPMENT_ARGUMENT_INVALID");
      }

      profile = argument.slice("--profile=".length);
      continue;
    }

    fail("LOCAL_DEVELOPMENT_ARGUMENT_INVALID");
  }

  if (profile !== "fixture" && profile !== "live") {
    fail("LOCAL_DEVELOPMENT_PROFILE_INVALID");
  }

  return { checkOnly, profile };
};

const localBinary = (root, name) => join(root, "node_modules", ".bin", name);

export const createLocalServiceSpecs = ({ profile, projectRoot: root }) => {
  if (profile !== "fixture" && profile !== "live") {
    fail("LOCAL_DEVELOPMENT_PROFILE_INVALID");
  }

  const environment = {
    INNGEST_DEV: "1",
    RESEARCH_PROVIDER_MODE: profile,
  };

  return [
    {
      name: "next",
      command: localBinary(root, "next"),
      args: [
        "dev",
        "--hostname",
        localDevelopmentConstants.appHost,
        "--port",
        String(localDevelopmentConstants.appPort),
      ],
      cwd: root,
      environment,
    },
    {
      name: "inngest",
      command: localBinary(root, "inngest-cli"),
      args: [
        "dev",
        "--no-discovery",
        "--host",
        localDevelopmentConstants.inngestHost,
        "--port",
        String(localDevelopmentConstants.inngestPort),
        "--sdk-url",
        `http://${localDevelopmentConstants.appHost}:${localDevelopmentConstants.appPort}/api/inngest`,
        "--queue-workers",
        "5",
        "--tick",
        "1000",
        "--persist",
        "--log-level",
        "warn",
      ],
      cwd: join(root, "output", "inngest"),
      environment,
    },
  ];
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

const runServices = async (specs) => {
  const children = specs.map((spec) => ({
    child: spawn(spec.command, spec.args, {
      cwd: spec.cwd,
      env: { ...process.env, ...spec.environment },
      stdio: "inherit",
    }),
    name: spec.name,
  }));
  const stopServices = () => children.forEach(({ child }) => stopChild(child));
  process.once("SIGINT", stopServices);
  process.once("SIGTERM", stopServices);

  try {
    const result = await Promise.race(
      children.map(({ child, name }) => waitForChild(child, name)),
    );
    stopServices();
    process.exitCode = result.code ?? (result.signal ? 0 : 1);
  } finally {
    process.removeListener("SIGINT", stopServices);
    process.removeListener("SIGTERM", stopServices);
    stopServices();
  }
};

const assertLocalPortsAvailable = () =>
  Promise.all([
    assertPortAvailable({
      host: localDevelopmentConstants.appHost,
      port: localDevelopmentConstants.appPort,
    }),
    assertPortAvailable({
      host: localDevelopmentConstants.inngestHost,
      port: localDevelopmentConstants.inngestPort,
    }),
  ]);

const main = async () => {
  const { checkOnly, profile } = parseLocalDevelopmentArguments(
    process.argv.slice(2),
  );
  assertSupportedNodeVersion(process.version);
  await secureEnvironmentFile(join(projectRoot, ".env.local"));
  validateHostedDevelopmentEnvironment({ environment: process.env, profile });
  await assertLocalPortsAvailable();

  if (checkOnly) {
    console.log("[local-dev] ready");
    return;
  }

  const specs = createLocalServiceSpecs({ profile, projectRoot });
  await mkdir(join(projectRoot, "output", "inngest"), { recursive: true });

  console.log(
    `[local-dev] Local research workspace: http://${localDevelopmentConstants.appHost}:${localDevelopmentConstants.appPort}/zh/auth/login`,
  );
  console.log(
    `[local-dev] Inngest: http://${localDevelopmentConstants.inngestHost}:${localDevelopmentConstants.inngestPort}`,
  );
  await runServices(specs);
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
