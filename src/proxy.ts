import { hasLocale } from "next-intl";
import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { routing } from "./i18n/routing";
import { refreshSupabaseSession } from "./lib/supabase/proxy";

const handleI18nRouting = createMiddleware(routing);
const localeSegmentPattern = /^[a-z]{2}(?:-[a-z]{2})?$/i;

export default async function proxy(request: NextRequest) {
  const localeSegment = request.nextUrl.pathname.split("/")[1];

  if (
    localeSegmentPattern.test(localeSegment) &&
    !hasLocale(routing.locales, localeSegment)
  ) {
    return new NextResponse(null, { status: 404 });
  }

  const response = handleI18nRouting(request);
  const isManagedPath = /^\/(?:zh|en)\/(?:app|auth)(?:\/|$)/.test(
    request.nextUrl.pathname,
  );

  return isManagedPath
    ? refreshSupabaseSession(request, response)
    : response;
}

export const config = {
  matcher: "/((?!api|auth|trpc|_next|_vercel|.*\\..*).*)",
};
