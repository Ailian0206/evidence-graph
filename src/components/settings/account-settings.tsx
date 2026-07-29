"use client";

import { LoaderCircle, Save, Trash2, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  deleteAccount,
  type DeleteAccountState,
  type LanguagePreferenceState,
  saveLanguagePreference,
} from "@/features/settings/actions";
import type { AppLocale } from "@/i18n/routing";

import styles from "./account-settings.module.css";

type AccountSettingsProps = {
  locale: AppLocale;
  profile: {
    displayName: string | null;
    githubUsername: string | null;
    language: AppLocale;
  };
  user: {
    displayName: string | null;
    email: string | null;
  };
};

const initialLanguageState: LanguagePreferenceState = { status: "idle" };
const initialDeleteState: DeleteAccountState = { status: "idle" };

function LanguageSubmitButton() {
  const t = useTranslations("Settings.language");
  const { pending } = useFormStatus();

  return (
    <button className={styles.primaryButton} type="submit" disabled={pending}>
      {pending ? (
        <LoaderCircle className={styles.spinner} aria-hidden="true" size={17} />
      ) : (
        <Save aria-hidden="true" size={17} />
      )}
      {pending ? t("saving") : t("save")}
    </button>
  );
}

function DeleteAccountButton({ confirmationMatches }: { confirmationMatches: boolean }) {
  const t = useTranslations("Settings.danger");
  const { pending } = useFormStatus();

  return (
    <button
      className={styles.dangerButton}
      type="submit"
      disabled={!confirmationMatches || pending}
    >
      {pending ? (
        <LoaderCircle className={styles.spinner} aria-hidden="true" size={17} />
      ) : (
        <Trash2 aria-hidden="true" size={17} />
      )}
      {pending ? t("deleting") : t("delete")}
    </button>
  );
}

export function AccountSettings({ locale, profile, user }: AccountSettingsProps) {
  const t = useTranslations("Settings");
  const saveAction = saveLanguagePreference.bind(null, locale);
  const deleteAction = deleteAccount.bind(null, locale);
  const [languageState, languageFormAction] = useActionState(
    saveAction,
    initialLanguageState,
  );
  const [deleteState, deleteFormAction] = useActionState(
    deleteAction,
    initialDeleteState,
  );
  const [confirmation, setConfirmation] = useState("");
  const accountName = user.displayName?.trim() || user.email?.trim() || null;
  const visibleName = profile.githubUsername || accountName || t("account.fallback");
  const showEmail = Boolean(user.email && user.email !== visibleName);
  const confirmationMatches = Boolean(accountName && confirmation === accountName);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>{t("eyebrow")}</p>
          <h1>{t("title")}</h1>
          <p className={styles.description}>{t("description")}</p>
        </header>

        <section className={styles.section} aria-labelledby="settings-account-title">
          <div className={styles.sectionHeading}>
            <h2 id="settings-account-title">{t("account.title")}</h2>
            <p>{t("account.description")}</p>
          </div>
          <div className={styles.identity}>
            <UserRound aria-hidden="true" size={20} />
            <span>
              <strong>{visibleName}</strong>
              {showEmail ? <small>{user.email}</small> : null}
            </span>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="settings-language-title">
          <div className={styles.sectionHeading}>
            <h2 id="settings-language-title">{t("language.title")}</h2>
            <p>{t("language.description")}</p>
          </div>
          <form className={styles.form} action={languageFormAction}>
            <div className={styles.field}>
              <label htmlFor="settings-language">{t("language.label")}</label>
              <select
                id="settings-language"
                name="language"
                defaultValue={profile.language}
              >
                <option value="zh">{t("language.options.zh")}</option>
                <option value="en">{t("language.options.en")}</option>
              </select>
            </div>
            <LanguageSubmitButton />
          </form>
          {languageState.status === "error" ? (
            <p className={styles.error} role="alert">
              {t(`language.errors.${languageState.code ?? "LANGUAGE_UPDATE_FAILED"}`)}
            </p>
          ) : null}
        </section>

        <section
          className={`${styles.section} ${styles.dangerSection}`}
          aria-labelledby="settings-delete-title"
        >
          <div className={styles.sectionHeading}>
            <h2 id="settings-delete-title">{t("danger.title")}</h2>
            <p>{t("danger.description")}</p>
          </div>
          {accountName ? (
            <form className={styles.dangerForm} action={deleteFormAction}>
              <p className={styles.confirmationInstruction}>
                {t("danger.confirmationInstruction", { account: accountName })}
              </p>
              <div className={styles.field}>
                <label htmlFor="account-confirmation">
                  {t("danger.confirmationLabel")}
                </label>
                <input
                  id="account-confirmation"
                  name="confirmation"
                  type="text"
                  autoComplete="off"
                  maxLength={320}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </div>
              <DeleteAccountButton confirmationMatches={confirmationMatches} />
            </form>
          ) : (
            <p className={styles.error} role="alert">
              {t("danger.errors.ACCOUNT_CONFIRMATION_UNAVAILABLE")}
            </p>
          )}
          {deleteState.status === "error" ? (
            <p className={styles.error} role="alert">
              {t(`danger.errors.${deleteState.code ?? "ACCOUNT_DELETE_FAILED"}`)}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
