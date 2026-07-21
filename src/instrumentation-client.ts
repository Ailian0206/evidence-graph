import * as Sentry from "@sentry/nextjs";

import { createSentryOptions } from "@/observability/sentry-config";

const options = createSentryOptions({
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
});

if (options) {
  Sentry.init(options);
}

export function onRouterTransitionStart(url: string, navigationType: string) {
  if (options) {
    Sentry.captureRouterTransitionStart(url, navigationType);
  }
}
