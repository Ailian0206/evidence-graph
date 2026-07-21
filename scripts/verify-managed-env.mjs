const requiredGroups = [
  {
    name: "Supabase 公开客户端",
    variables: [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ],
  },
  {
    name: "Supabase 服务端",
    variables: ["SUPABASE_SERVICE_ROLE_KEY"],
  },
  {
    name: "Inngest",
    variables: ["INNGEST_EVENT_KEY", "INNGEST_SIGNING_KEY"],
  },
  {
    name: "Sentry 运行时",
    variables: ["NEXT_PUBLIC_SENTRY_DSN"],
  },
];

const optionalGroups = [
  {
    name: "Sentry Source Map 上传",
    variables: ["SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT"],
  },
];

const missingVariables = (variables) =>
  variables.filter((name) => !process.env[name]?.trim());

console.log("托管环境变量检查");

let hasMissingRequiredVariables = false;

for (const group of requiredGroups) {
  const missing = missingVariables(group.variables);

  if (missing.length === 0) {
    console.log(`[已配置] ${group.name}`);
  } else {
    hasMissingRequiredVariables = true;
    console.error(`[缺失] ${group.name}: ${missing.join(", ")}`);
  }
}

for (const group of optionalGroups) {
  const missing = missingVariables(group.variables);

  if (missing.length === 0) {
    console.log(`[已配置] ${group.name}`);
  } else {
    console.warn(`[可选未配置] ${group.name}: ${missing.join(", ")}`);
  }
}

console.log("付费 Provider 密钥不属于默认托管环境门禁。");

if (hasMissingRequiredVariables) {
  console.error("MANAGED_ENV_INCOMPLETE");
  process.exitCode = 1;
} else {
  console.log("托管环境变量检查通过");
}
