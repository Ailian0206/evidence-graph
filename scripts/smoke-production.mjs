const PRODUCTION_SMOKE_CONFIRMATION = "YES_I_ACCEPT_REAL_WRITES";
const REQUEST_TIMEOUT_MS = 15_000;

const requireProductionBaseUrl = (environment) => {
  if (environment.ALLOW_PRODUCTION_SMOKE !== PRODUCTION_SMOKE_CONFIRMATION) {
    throw new Error("PRODUCTION_SMOKE_NOT_CONFIRMED");
  }

  let url;

  try {
    url = new URL(environment.PRODUCTION_BASE_URL ?? "");
  } catch {
    throw new Error("PRODUCTION_BASE_URL_INVALID");
  }

  const hostname = url.hostname.toLowerCase();
  const isLocal =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.startsWith("127.") ||
    hostname === "0.0.0.0" ||
    hostname === "[::1]" ||
    hostname.endsWith(".local");

  if (url.protocol !== "https:" || isLocal) {
    throw new Error("PRODUCTION_BASE_URL_INVALID");
  }

  return url.origin;
};

const request = (baseUrl, path, init = {}) =>
  fetch(new URL(path, baseUrl), {
    redirect: "manual",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    ...init,
  });

const requireStatus = (response, expected, checkName) => {
  if (!expected.includes(response.status)) {
    throw new Error(`${checkName}: HTTP_${response.status}`);
  }
};

const checkPublicHome = async (baseUrl) => {
  const response = await request(baseUrl, "/zh");
  requireStatus(response, [200], "PUBLIC_HOME_FAILED");

  const exactHeaders = {
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  };

  for (const [name, expected] of Object.entries(exactHeaders)) {
    if (response.headers.get(name) !== expected) {
      throw new Error(`SECURITY_HEADER_INVALID: ${name}`);
    }
  }

  if (
    !response.headers
      .get("content-security-policy")
      ?.includes("frame-ancestors 'none'")
  ) {
    throw new Error("SECURITY_HEADER_INVALID: content-security-policy");
  }
};

const checkPublicDemo = async (baseUrl) => {
  const response = await request(baseUrl, "/zh/app/research/demo");
  requireStatus(response, [200], "PUBLIC_DEMO_FAILED");
};

const checkAuthRedirect = async (baseUrl) => {
  const response = await request(baseUrl, "/zh/app");
  requireStatus(response, [302, 303, 307, 308], "AUTH_REDIRECT_FAILED");

  const location = response.headers.get("location");

  if (!location || new URL(location, baseUrl).pathname !== "/zh/auth/login") {
    throw new Error("AUTH_REDIRECT_LOCATION_INVALID");
  }
};

const checkInngestSignatureRejection = async (baseUrl) => {
  const response = await request(baseUrl, "/api/inngest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  requireStatus(response, [401, 403], "INNGEST_SIGNATURE_REJECTION_FAILED");
};

const run = async () => {
  const baseUrl = requireProductionBaseUrl(process.env);
  const checks = [
    ["公开首页与安全 Header", checkPublicHome],
    ["公开确定性示例", checkPublicDemo],
    ["未登录访问重定向", checkAuthRedirect],
    ["Inngest 无签名请求拒绝", checkInngestSignatureRejection],
  ];

  for (const [name, check] of checks) {
    await check(baseUrl);
    console.log(`[通过] ${name}`);
  }

  console.log("付费 Provider：未执行（专用冒烟上限 0.10 USD）");
  console.log("生产冒烟检查通过");
};

try {
  await run();
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "PRODUCTION_SMOKE_FAILED",
  );
  process.exitCode = 1;
}
