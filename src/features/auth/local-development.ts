import "server-only";

type LocalDevelopmentAuthEnvironment = {
  nodeEnv?: string;
  enabled?: string;
  supabaseUrl?: string;
};

const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

export const isLocalDevelopmentAuthEnabled = (
  environment: LocalDevelopmentAuthEnvironment = {
    nodeEnv: process.env.NODE_ENV,
    enabled: process.env.LOCAL_DEV_AUTH_ENABLED,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  },
) => {
  if (environment.nodeEnv === "production" || environment.enabled !== "true") {
    return false;
  }

  try {
    const url = new URL(environment.supabaseUrl ?? "");
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      loopbackHosts.has(url.hostname)
    );
  } catch {
    return false;
  }
};
