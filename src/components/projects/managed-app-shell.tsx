"use client";

import { FileText, FolderKanban, LogOut, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";

import { signOut } from "@/features/auth/actions";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

import styles from "./managed-app-shell.module.css";

type ManagedAppShellProps = {
  active: "projects" | "reports";
  children: React.ReactNode;
  locale: AppLocale;
  user: {
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
  const signOutAction = signOut.bind(null, locale);
  const accountName = user.displayName ?? user.email ?? t("accountFallback");
  const showEmail = Boolean(user.email && user.email !== accountName);

  return (
    <div className={styles.frame}>
      <header className={styles.header}>
        <Link className={styles.product} href="/app">
          <span className={styles.productMark} aria-hidden="true">
            EG
          </span>
          <strong>Evidence Graph</strong>
        </Link>

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
        </nav>

        <div className={styles.account}>
          <UserRound aria-hidden="true" size={18} />
          <span className={styles.accountText}>
            <strong>{accountName}</strong>
            {showEmail ? <small>{user.email}</small> : null}
          </span>
          <form action={signOutAction}>
            <button
              className={styles.signOutButton}
              type="submit"
              aria-label={t("signOut")}
              title={t("signOut")}
            >
              <LogOut aria-hidden="true" size={17} />
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
