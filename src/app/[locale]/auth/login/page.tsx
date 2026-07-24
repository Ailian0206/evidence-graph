import type { Metadata } from "next";
import { LockKeyhole } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { GitHubSignInButton } from "@/components/auth/github-sign-in-button";
import { signInWithGitHub } from "@/features/auth/actions";
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
  const nextPath = getSafeAppPath(locale, next);
  const githubAction = signInWithGitHub.bind(null, locale, nextPath);

  return (
    <div className={styles.page}>
      <section className={styles.panel} aria-labelledby="auth-title">
        <p className={styles.eyebrow}>{t("eyebrow")}</p>
        <LockKeyhole aria-hidden="true" className={styles.icon} size={28} />
        <h1 id="auth-title">{t("title")}</h1>
        <p className={styles.description}>{t("description")}</p>
        <form action={githubAction} className={styles.form}>
          <GitHubSignInButton
            configured={configured}
            label={t("github")}
            pendingLabel={t("githubPending")}
          />
        </form>
        {!configured ? (
          <p className={styles.status} role="status">
            {t("unconfigured")}
          </p>
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
