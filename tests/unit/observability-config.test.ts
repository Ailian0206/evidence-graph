import { describe, expect, it } from "vitest";

import {
  createSentryOptions,
  sanitizeSentryEvent,
} from "@/observability/sentry-config";

describe("optional observability configuration", () => {
  it("does not initialize Sentry without a DSN", () => {
    expect(createSentryOptions({})).toBeNull();
    expect(createSentryOptions({ NEXT_PUBLIC_SENTRY_DSN: " " })).toBeNull();
  });

  it("creates privacy-first options only for a valid DSN", () => {
    const options = createSentryOptions({
      NEXT_PUBLIC_SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
    });

    expect(options).toMatchObject({
      dsn: "https://public@example.ingest.sentry.io/1",
      enabled: true,
      sendDefaultPii: false,
      tracesSampleRate: 0.05,
    });
    expect(options?.beforeSend).toBeTypeOf("function");
  });

  it("removes private research and identity fields recursively", () => {
    const sanitized = sanitizeSentryEvent({
      user: {
        id: "user_1",
        email: "private@example.com",
        githubUsername: "private-handle",
      },
      contexts: {
        research: {
          question: "private research question",
          body: "private source text",
          quote: "private exact quote",
          providerPayload: { prompt: "private prompt" },
          projectId: "project_1",
        },
      },
    });
    const serialized = JSON.stringify(sanitized);

    expect(serialized).not.toContain("private@example.com");
    expect(serialized).not.toContain("private-handle");
    expect(serialized).not.toContain("private research question");
    expect(serialized).not.toContain("private source text");
    expect(serialized).not.toContain("private exact quote");
    expect(serialized).not.toContain("private prompt");
    expect(sanitized).toMatchObject({
      user: { id: "user_1" },
      contexts: { research: { projectId: "project_1" } },
    });
  });
});
