import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const sourceRoot = join(root, "src");
const sourceExtensions = new Set([".js", ".mjs", ".ts", ".tsx"]);
const forbiddenEndpoints = ["api.openai.com", "api.tavily.com"];
const forbiddenProviderImports = ["openai", "tavily", "@tavily/core"];
const serverOnlyVariables = [
  "INNGEST_SIGNING_KEY",
  "OPENAI_API_KEY",
  "SENTRY_AUTH_TOKEN",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TAVILY_API_KEY",
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

  for (const endpoint of forbiddenEndpoints) {
    if (source.includes(endpoint)) {
      findings.push(`${displayPath}: forbidden Provider endpoint ${endpoint}`);
    }
  }

  const isClientModule =
    /^\s*["']use client["'];/m.test(source) ||
    displayPath.endsWith("instrumentation-client.ts");

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
    /\bfetch\s*\(|\bhttps?\.request\s*\(/.test(source)
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
