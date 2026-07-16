"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { createSentryOptions } from "@/observability/sentry-config";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const configured = createSentryOptions({
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    });

    if (configured) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <html lang="zh">
      <body>
        <main>
          <h1>页面暂时无法显示 / Something went wrong</h1>
          <button type="button" onClick={reset}>
            重新尝试 / Try again
          </button>
        </main>
      </body>
    </html>
  );
}
