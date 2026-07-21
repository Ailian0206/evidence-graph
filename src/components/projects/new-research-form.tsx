"use client";

import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import {
  createResearch,
  type CreateResearchFormState,
} from "@/features/projects/actions";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

import styles from "./project-workspace.module.css";

const initialState: CreateResearchFormState = { status: "idle" };

export function NewResearchForm({ locale }: { locale: AppLocale }) {
  const t = useTranslations("Projects");
  const [urlFields, setUrlFields] = useState([0]);
  const [nextUrlFieldId, setNextUrlFieldId] = useState(1);
  const action = createResearch.bind(null, locale);
  const [state, formAction, pending] = useActionState(action, initialState);

  const addUrlField = () => {
    if (urlFields.length >= 5) {
      return;
    }

    setUrlFields((current) => [...current, nextUrlFieldId]);
    setNextUrlFieldId((current) => current + 1);
  };

  const removeUrlField = (fieldId: number) => {
    setUrlFields((current) => current.filter((id) => id !== fieldId));
  };

  const fieldError = (field: "title" | "question" | "language" | "manualUrls") =>
    state.fieldErrors?.[field]?.length ? t(`form.errors.${field}`) : null;

  return (
    <div className={styles.page}>
      <div className={styles.formShell}>
        <header className={styles.formHeader}>
          <p className={styles.eyebrow}>{t("form.eyebrow")}</p>
          <h1>{t("form.title")}</h1>
          <p className={styles.description}>{t("form.description")}</p>
        </header>

        <form action={formAction} className={styles.form} noValidate>
          <div className={styles.field}>
            <label htmlFor="research-title">{t("form.fields.title")}</label>
            <input
              id="research-title"
              name="title"
              type="text"
              maxLength={120}
              required
              aria-invalid={Boolean(fieldError("title"))}
              aria-describedby={fieldError("title") ? "research-title-error" : undefined}
            />
            {fieldError("title") ? (
              <p id="research-title-error" className={styles.fieldError}>
                {fieldError("title")}
              </p>
            ) : null}
          </div>

          <div className={styles.field}>
            <label htmlFor="research-question">{t("form.fields.question")}</label>
            <textarea
              id="research-question"
              name="question"
              maxLength={2000}
              required
              aria-invalid={Boolean(fieldError("question"))}
              aria-describedby={fieldError("question") ? "research-question-error" : undefined}
            />
            {fieldError("question") ? (
              <p id="research-question-error" className={styles.fieldError}>
                {fieldError("question")}
              </p>
            ) : null}
          </div>

          <div className={styles.field}>
            <label htmlFor="research-language">{t("form.fields.language")}</label>
            <select id="research-language" name="language" defaultValue={locale}>
              <option value="zh">{t("language.zh")}</option>
              <option value="en">{t("language.en")}</option>
            </select>
          </div>

          <fieldset className={styles.urlFieldset}>
            <legend className={styles.visuallyHidden}>{t("form.fields.manualUrls")}</legend>
            <div className={styles.urlHeader}>
              <strong>{t("form.fields.manualUrls")}</strong>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={addUrlField}
                disabled={urlFields.length >= 5}
              >
                <Plus aria-hidden="true" size={15} />
                {t("form.addUrl")}
              </button>
            </div>
            {urlFields.map((fieldId, index) => (
              <div className={styles.urlRow} key={fieldId}>
                <label className={styles.visuallyHidden} htmlFor={`manual-url-${fieldId}`}>
                  {t("form.urlLabel", { index: index + 1 })}
                </label>
                <input
                  id={`manual-url-${fieldId}`}
                  name="manualUrls"
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  aria-invalid={Boolean(fieldError("manualUrls"))}
                  aria-describedby={
                    fieldError("manualUrls") ? "research-manual-urls-error" : undefined
                  }
                />
                {urlFields.length > 1 ? (
                  <button
                    className={styles.iconButton}
                    type="button"
                    onClick={() => removeUrlField(fieldId)}
                    aria-label={t("form.removeUrl", { index: index + 1 })}
                    title={t("form.removeUrl", { index: index + 1 })}
                  >
                    <X aria-hidden="true" size={17} />
                  </button>
                ) : null}
              </div>
            ))}
            {fieldError("manualUrls") ? (
              <p id="research-manual-urls-error" className={styles.fieldError}>
                {fieldError("manualUrls")}
              </p>
            ) : null}
          </fieldset>

          {state.code === "MONTHLY_RUN_LIMIT_EXCEEDED" ? (
            <p className={styles.formError} role="alert">
              {t("form.errors.monthlyLimit")}
            </p>
          ) : null}
          {state.code === "ACTIVE_RESEARCH_RUN_EXISTS" ? (
            <p className={styles.formError} role="alert">
              {t("form.errors.activeRun")}
            </p>
          ) : null}
          {state.code === "INVALID_INPUT" ? (
            <p className={styles.formError} role="alert">
              {t("form.errors.invalid")}
            </p>
          ) : null}

          <div className={styles.formActions}>
            <Link className={styles.backLink} href="/app">
              {t("form.back")}
            </Link>
            <button className={styles.submitButton} type="submit" disabled={pending}>
              {pending ? t("form.submitting") : t("form.submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
