import { getLocale, getTranslations } from "next-intl/server";

import { notes } from "@/content/notes";
import type { AppLocale } from "@/i18n/routing";

import { NoteRows } from "./note-rows";

export async function PracticeNotes() {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("Portfolio");

  return (
    <section className="portfolio-section practice-notes">
      <header className="section-heading content-width">
        <p className="section-index">02 / Notes</p>
        <div>
          <h2>{t("practiceNotes")}</h2>
          <p>{t("practiceNotesDescription")}</p>
        </div>
      </header>
      <NoteRows notes={notes} locale={locale} />
    </section>
  );
}
