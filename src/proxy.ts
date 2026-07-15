import { hasLocale } from "next-intl";
import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);
const localeSegmentPattern = /^[a-z]{2}(?:-[a-z]{2})?$/i;

export default function proxy(request: NextRequest) {
  const localeSegment = request.nextUrl.pathname.split("/")[1];

  if (
    localeSegmentPattern.test(localeSegment) &&
    !hasLocale(routing.locales, localeSegment)
  ) {
    return new NextResponse(null, { status: 404 });
  }

  return handleI18nRouting(request);
}

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
