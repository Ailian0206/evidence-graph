import * as Sentry from "@sentry/nextjs";

import { createSentryOptions } from "@/observability/sentry-config";

const options = createSentryOptions({
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
});

if (options) {
  Sentry.init(options);
}
