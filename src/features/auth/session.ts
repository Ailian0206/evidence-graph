import type { AppLocale } from "@/i18n/routing";

type AuthenticatedUser = {
  id: string;
  email?: string | null;
};

type RequireUserInput = {
  locale: AppLocale;
  nextPath?: string;
  getUser: () => Promise<AuthenticatedUser | null>;
  redirectTo: (path: string) => never;
};

export const getSafeAppPath = (locale: AppLocale, nextPath?: string) => {
  const appRoot = `/${locale}/app`;

  if (nextPath === appRoot || nextPath?.startsWith(`${appRoot}/`)) {
    return nextPath;
  }

  return appRoot;
};

export const createLoginRedirect = ({
  locale,
  nextPath,
}: {
  locale: AppLocale;
  nextPath?: string;
}) => {
  const search = new URLSearchParams({ next: getSafeAppPath(locale, nextPath) });
  return `/${locale}/auth/login?${search.toString()}`;
};

export const requireUser = async ({
  locale,
  nextPath,
  getUser,
  redirectTo,
}: RequireUserInput) => {
  const user = await getUser();

  if (!user) {
    return redirectTo(createLoginRedirect({ locale, nextPath }));
  }

  return {
    id: user.id,
    email: user.email ?? null,
  };
};
