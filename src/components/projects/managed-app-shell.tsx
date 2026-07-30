"use client";

import {
  ArrowLeft,
  FileText,
  FolderKanban,
  Languages,
  LogOut,
  Settings as SettingsIcon,
  UserRound,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { signOut } from "@/features/auth/actions";
import { Link, usePathname } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

import styles from "./managed-app-shell.module.css";

type ManagedAppShellProps = {
  active?: "projects" | "reports" | "settings";
  children: React.ReactNode;
  locale: AppLocale;
  user?: {
    displayName: string | null;
    email: string | null;
  };
};

export function ManagedAppShell({
  active,
  children,
  locale,
  user,
}: ManagedAppShellProps) {
  const t = useTranslations("AppShell");
  const pathname = usePathname();
  const alternateLocale: AppLocale = locale === "zh" ? "en" : "zh";
  const signOutAction = signOut.bind(null, locale);
  const accountName = user
    ? (user.displayName ?? user.email ?? t("accountFallback"))
    : null;
  const showEmail = Boolean(user?.email && user.email !== accountName);

  return (
    <div className={styles.frame} data-mode={user ? "authenticated" : "entry"}>
      <header
        className={styles.header}
        data-mode={user ? "authenticated" : "entry"}
        data-product-shell
      >
        <div className={styles.brandGroup}>
          <Link
            className={styles.portfolioLink}
            href="/"
            aria-label={t("portfolio")}
            title={t("portfolio")}
          >
            <ArrowLeft aria-hidden="true" size={18} />
          </Link>
          <Link className={styles.product} href="/app" aria-label="Evidence Graph">
            <span className={styles.productMark} aria-hidden="true">
              EG
            </span>
            <strong>Evidence Graph</strong>
          </Link>
        </div>

        {user ? (
          <nav className={styles.navigation} aria-label={t("navigationLabel")}>
            <Link href="/app" aria-current={active === "projects" ? "page" : undefined}>
              <FolderKanban aria-hidden="true" size={17} />
              {t("projects")}
            </Link>
            <Link
              href="/app/reports"
              aria-current={active === "reports" ? "page" : undefined}
            >
              <FileText aria-hidden="true" size={17} />
              {t("reports")}
            </Link>
            <Link
              href="/app/settings"
              aria-current={active === "settings" ? "page" : undefined}
            >
              <SettingsIcon aria-hidden="true" size={17} />
              {t("settings")}
            </Link>
          </nav>
        ) : null}

        <div className={styles.utilities}>
          <Link
            className={styles.iconButton}
            href={pathname}
            locale={alternateLocale}
            aria-label={t("language")}
            title={t("language")}
          >
            <Languages aria-hidden="true" size={18} />
          </Link>
          {user ? (
            <div className={styles.account}>
              <UserRound aria-hidden="true" size={18} />
              <span className={styles.accountText}>
                <strong>{accountName}</strong>
                {showEmail ? <small>{user.email}</small> : null}
              </span>
              <form action={signOutAction}>
                <button
                  className={styles.iconButton}
                  type="submit"
                  aria-label={t("signOut")}
                  title={t("signOut")}
                >
                  <LogOut aria-hidden="true" size={17} />
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
