import { z } from "zod";

const privateKeys = new Set([
  "body",
  "email",
  "github_username",
  "githubusername",
  "payload",
  "providerpayload",
  "question",
  "quote",
  "researchquestion",
  "sourcebody",
]);

const sanitizeValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !privateKeys.has(key.toLowerCase()))
      .map(([key, nestedValue]) => [key, sanitizeValue(nestedValue)]),
  );
};

export const sanitizeSentryEvent = <T>(event: T): T => sanitizeValue(event) as T;

export const createSentryOptions = (environment: {
  NEXT_PUBLIC_SENTRY_DSN?: string;
}) => {
  const parsed = z.string().url().safeParse(environment.NEXT_PUBLIC_SENTRY_DSN?.trim());

  if (!parsed.success) {
    return null;
  }

  return {
    dsn: parsed.data,
    enabled: true,
    sendDefaultPii: false,
    tracesSampleRate: 0.05,
    beforeSend: sanitizeSentryEvent,
  };
};
