import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { NoteRows } from "@/components/portfolio/note-rows";
import { notes } from "@/content/notes";
import type { AppLocale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}): Promise<Metadata> {
  const { locale } = await params;

  return {
    title: locale === "zh" ? "工程笔记" : "Notes",
  };
}

export default async function NotesPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Portfolio");

  return (
    <div className="public-page">
      <header className="page-intro content-width">
        <p className="section-index">02 / Notes</p>
        <h1>{t("practiceNotes")}</h1>
        <p>{t("practiceNotesDescription")}</p>
      </header>
      <NoteRows notes={notes} locale={locale} />
    </div>
  );
}
