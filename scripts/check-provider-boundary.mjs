import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const sourceRoot = join(root, "src");
const sourceExtensions = new Set([".js", ".mjs", ".ts", ".tsx"]);
const endpointAllowlist = new Map([
  ["api.openai.com", new Set()],
  ["api.tavily.com", new Set(["src/providers/live/tavily-provider.ts"])],
  ["api.deepseek.com", new Set(["src/providers/live/deepseek-language-model.ts"])],
  [
    "cn-beijing.maas.aliyuncs.com",
    new Set(["src/providers/live/bailian-embedding-provider.ts"]),
  ],
]);
const forbiddenProviderImports = ["openai", "tavily", "@tavily/core"];
const publicProviderVariablePattern =
  /\bNEXT_PUBLIC_[A-Z0-9_]*PROVIDER[A-Z0-9_]*\b/g;
const networkCapableProviderFiles = new Set([
  "src/providers/live/bailian-embedding-provider.ts",
  "src/providers/live/deepseek-language-model.ts",
  "src/providers/live/tavily-provider.ts",
]);
const requestProviderJsonFiles = new Set([
  ...networkCapableProviderFiles,
  "src/providers/live/provider-http.ts",
]);
const reviewedLiveEndpointDomains = new Map([
  [
    "src/providers/live/provider-http.ts",
    { exact: new Set(), suffixes: new Set() },
  ],
  [
    "src/providers/live/model-prompts.ts",
    { exact: new Set(), suffixes: new Set() },
  ],
  [
    "src/providers/live/tavily-provider.ts",
    { exact: new Set(["api.tavily.com"]), suffixes: new Set() },
  ],
  [
    "src/providers/live/deepseek-language-model.ts",
    { exact: new Set(["api.deepseek.com"]), suffixes: new Set() },
  ],
  [
    "src/providers/live/bailian-embedding-provider.ts",
    {
      exact: new Set(),
      suffixes: new Set(["cn-beijing.maas.aliyuncs.com"]),
    },
  ],
]);
const serverOnlyVariables = [
  "INNGEST_SIGNING_KEY",
  "OPENAI_API_KEY",
  "SENTRY_AUTH_TOKEN",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TAVILY_API_KEY",
  "DEEPSEEK_API_KEY",
  "BAILIAN_API_KEY",
  "BAILIAN_WORKSPACE_ID",
];
const directNetworkCapabilityPatterns = [
  /\bfetch\b/,
  /\bdefaultProviderFetch\b/,
  /["']node:https?["']/,
  /https?:\/\//,
];

const listSourceFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listSourceFiles(path) : [path];
    }),
  );
  return files.flat().filter((path) => sourceExtensions.has(extname(path)));
};

const findings = [];

for (const path of await listSourceFiles(sourceRoot)) {
  const source = await readFile(path, "utf8");
  const displayPath = relative(root, path);
  const isLiveProvider = displayPath.startsWith("src/providers/live/");
  const isProviderRuntime = displayPath === "src/providers/runtime.ts";
  const importsServerOnly = /^\s*import\s+["']server-only["'];/m.test(source);

  if (isLiveProvider && !importsServerOnly) {
    findings.push(`${displayPath}: live Provider module must import server-only`);
  }

  if (isProviderRuntime && !importsServerOnly) {
    findings.push(`${displayPath}: Provider runtime module must import server-only`);
  }

  for (const [endpoint, allowedFiles] of endpointAllowlist) {
    if (source.includes(endpoint) && !allowedFiles.has(displayPath)) {
      findings.push(`${displayPath}: forbidden Provider endpoint ${endpoint}`);
    }
  }

  const approvedDomains = reviewedLiveEndpointDomains.get(displayPath);

  if (approvedDomains) {
    for (const match of source.matchAll(/https?:\/\/([^/"'`\s]+)/g)) {
      const endpointDomain = match[1];
      const isApproved =
        approvedDomains.exact.has(endpointDomain) ||
        [...approvedDomains.suffixes].some((domain) =>
          endpointDomain.endsWith(`.${domain}`),
        );

      if (!isApproved) {
        findings.push(
          `${displayPath}: unapproved live Provider endpoint ${endpointDomain}`,
        );
      }
    }
  }

  const isClientModule =
    /^\s*["']use client["'];/m.test(source) ||
    displayPath.endsWith("instrumentation-client.ts");

  for (const variable of source.match(publicProviderVariablePattern) ?? []) {
    findings.push(
      `${displayPath}: public Provider environment variable ${variable} is not allowed`,
    );
  }

  if (isClientModule) {
    for (const variable of serverOnlyVariables) {
      if (source.includes(variable)) {
        findings.push(
          `${displayPath}: server-only variable ${variable} in client module`,
        );
      }
    }
  }

  const isNonFixtureProvider =
    displayPath.startsWith("src/providers/") &&
    !displayPath.startsWith("src/providers/fixtures/");

  if (
    isNonFixtureProvider &&
    !networkCapableProviderFiles.has(displayPath) &&
    directNetworkCapabilityPatterns.some((pattern) => pattern.test(source))
  ) {
    findings.push(
      `${displayPath}: network Provider implementation is not allowed`,
    );
  }

  if (
    isNonFixtureProvider &&
    !requestProviderJsonFiles.has(displayPath) &&
    /\brequestProviderJson\b/.test(source)
  ) {
    findings.push(
      `${displayPath}: network Provider implementation is not allowed`,
    );
  }

  if (
    isNonFixtureProvider &&
    forbiddenProviderImports.some((packageName) =>
      new RegExp(`["']${packageName.replace("/", "\\/")}["']`).test(source),
    )
  ) {
    findings.push(`${displayPath}: real Provider SDK import is not allowed`);
  }
}

if (findings.length > 0) {
  console.error(findings.join("\n"));
  process.exit(1);
}

console.log("Provider boundary check passed.");
