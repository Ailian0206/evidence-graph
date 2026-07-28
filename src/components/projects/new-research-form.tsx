"use client";

import { ArrowLeft, LoaderCircle, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";

import {
  createResearch,
  type CreateResearchFormState,
} from "@/features/projects/actions";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

import styles from "./project-workspace.module.css";

const initialState: CreateResearchFormState = { status: "idle" };

type ResearchDraft = {
  title: string;
  question: string;
  language: AppLocale;
  manualUrls: Array<{ id: number; value: string }>;
};

export function NewResearchForm({ locale }: { locale: AppLocale }) {
  const t = useTranslations("Projects");
  const [draft, setDraft] = useState<ResearchDraft>({
    title: "",
    question: "",
    language: locale,
    manualUrls: [{ id: 0, value: "" }],
  });
  const [nextUrlFieldId, setNextUrlFieldId] = useState(1);
  const action = createResearch.bind(null, locale);
  const [state, formAction, pending] = useActionState(action, initialState);

  // React resets action forms after commit, so errors need one render to restore the draft.
  useEffect(() => {
    if (state.status === "error") {
      setDraft((current) => ({
        ...current,
        manualUrls: current.manualUrls.map((field) => ({ ...field })),
      }));
    }
  }, [state]);

  const addUrlField = () => {
    if (draft.manualUrls.length >= 5) {
      return;
    }

    setDraft((current) => ({
      ...current,
      manualUrls: [...current.manualUrls, { id: nextUrlFieldId, value: "" }],
    }));
    setNextUrlFieldId((current) => current + 1);
  };

  const removeUrlField = (fieldId: number) => {
    setDraft((current) => ({
      ...current,
      manualUrls: current.manualUrls.filter(({ id }) => id !== fieldId),
    }));
  };

  const fieldError = (field: "title" | "question" | "language" | "manualUrls") =>
    state.fieldErrors?.[field]?.length ? t(`form.errors.${field}`) : null;

  return (
    <div className={styles.page}>
      <div className={styles.formShell}>
        <header className={styles.formHeader} data-testid="research-form-header">
          <Link className={styles.backLink} href="/app">
            <ArrowLeft aria-hidden="true" size={16} />
            {t("form.back")}
          </Link>
          <p className={styles.eyebrow}>{t("form.eyebrow")}</p>
          <h1>{t("form.title")}</h1>
          <p className={styles.description}>{t("form.description")}</p>
        </header>

        <form action={formAction} className={styles.form} noValidate>
          <div className={styles.formColumns}>
            <section
              className={styles.formPrimary}
              data-testid="research-primary-fields"
            >
              <div className={styles.field}>
                <label htmlFor="research-title">{t("form.fields.title")}</label>
                <input
                  id="research-title"
                  name="title"
                  type="text"
                  autoComplete="off"
                  maxLength={120}
                  required
                  value={draft.title}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, title: event.target.value }))
                  }
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
                  autoComplete="off"
                  maxLength={2000}
                  required
                  value={draft.question}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, question: event.target.value }))
                  }
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
                <select
                  id="research-language"
                  name="language"
                  value={draft.language}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      language: event.target.value as AppLocale,
                    }))
                  }
                >
                  <option value="zh">{t("language.zh")}</option>
                  <option value="en">{t("language.en")}</option>
                </select>
              </div>
            </section>

            <section
              className={styles.formSources}
              data-testid="research-source-fields"
            >
              <fieldset className={styles.urlFieldset}>
                <legend className={styles.visuallyHidden}>{t("form.fields.manualUrls")}</legend>
                <div className={styles.urlHeader}>
                  <strong>{t("form.fields.manualUrls")}</strong>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={addUrlField}
                    disabled={draft.manualUrls.length >= 5}
                  >
                    <Plus aria-hidden="true" size={15} />
                    {t("form.addUrl")}
                  </button>
                </div>
                {draft.manualUrls.map((field, index) => (
                  <div className={styles.urlRow} key={field.id}>
                    <label className={styles.visuallyHidden} htmlFor={`manual-url-${field.id}`}>
                      {t("form.urlLabel", { index: index + 1 })}
                    </label>
                    <input
                      id={`manual-url-${field.id}`}
                      name="manualUrls"
                      type="url"
                      inputMode="url"
                      autoComplete="off"
                      placeholder="https://"
                      value={field.value}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          manualUrls: current.manualUrls.map((currentField) =>
                            currentField.id === field.id
                              ? { ...currentField, value: event.target.value }
                              : currentField,
                          ),
                        }))
                      }
                      aria-invalid={Boolean(fieldError("manualUrls"))}
                      aria-describedby={
                        fieldError("manualUrls") ? "research-manual-urls-error" : undefined
                      }
                    />
                    {draft.manualUrls.length > 1 ? (
                      <button
                        className={styles.iconButton}
                        type="button"
                        onClick={() => removeUrlField(field.id)}
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
            </section>
          </div>

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

          <div
            className={styles.formActions}
            data-testid="research-form-actions"
            aria-live="polite"
          >
            <button className={styles.submitButton} type="submit" disabled={pending}>
              {pending ? (
                <LoaderCircle
                  aria-hidden="true"
                  className={styles.spinner}
                  data-loading-indicator="true"
                  data-testid="research-create-loading"
                  size={17}
                />
              ) : null}
              {pending ? t("form.submitting") : t("form.submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
