import type { Metadata } from "next";
import { Laptop, LockKeyhole, LogIn } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import {
  signInForLocalDevelopment,
  signInWithGitHub,
} from "@/features/auth/actions";
import { isLocalDevelopmentAuthEnabled } from "@/features/auth/local-development";
import { getSafeAppPath } from "@/features/auth/session";
import type { AppLocale } from "@/i18n/routing";
import { isSupabasePublicConfigured } from "@/lib/supabase/config";

import styles from "./login.module.css";

type LoginPageProps = {
  params: Promise<{ locale: AppLocale }>;
  searchParams: Promise<{ next?: string; error?: string }>;
};

export async function generateMetadata({ params }: LoginPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  return { title: t("title") };
}

export default async function LoginPage({ params, searchParams }: LoginPageProps) {
  const { locale } = await params;
  const { next, error } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations("Auth");
  const configured = isSupabasePublicConfigured();
  const localDevelopmentEnabled = isLocalDevelopmentAuthEnabled();
  const nextPath = getSafeAppPath(locale, next);
  const githubAction = signInWithGitHub.bind(null, locale, nextPath);
  const localDevelopmentAction = signInForLocalDevelopment.bind(
    null,
    locale,
    nextPath,
  );

  return (
    <div className={styles.page}>
      <section className={styles.panel} aria-labelledby="auth-title">
        <p className={styles.eyebrow}>{t("eyebrow")}</p>
        <LockKeyhole aria-hidden="true" className={styles.icon} size={28} />
        <h1 id="auth-title">{t("title")}</h1>
        <p className={styles.description}>{t("description")}</p>
        <form action={githubAction} className={styles.form}>
          <button className={styles.button} type="submit" disabled={!configured}>
            <LogIn aria-hidden="true" size={18} />
            {t("github")}
          </button>
        </form>
        {!configured ? (
          <p className={styles.status} role="status">
            {t("unconfigured")}
          </p>
        ) : null}
        {localDevelopmentEnabled ? (
          <div className={styles.localAccess}>
            <p className={styles.localDescription}>{t("local.description")}</p>
            <form action={localDevelopmentAction}>
              <button
                className={`${styles.button} ${styles.localButton}`}
                type="submit"
              >
                <Laptop aria-hidden="true" size={18} />
                {t("local.action")}
              </button>
            </form>
          </div>
        ) : null}
        {error ? (
          <p className={styles.error} role="alert">
            {t("error")}
          </p>
        ) : null}
      </section>
    </div>
  );
}
