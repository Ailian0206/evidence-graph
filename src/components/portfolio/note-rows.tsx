import type { PracticeNote } from "@/content/types";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

const noteStatusLabels = {
  zh: {
    research: "调研中",
    draft: "草稿",
    published: "已发布",
  },
  en: {
    research: "Research",
    draft: "Draft",
    published: "Published",
  },
} as const;

export function NoteRows({
  notes,
  locale,
}: {
  notes: PracticeNote[];
  locale: AppLocale;
}) {
  return (
    <div className="note-rows content-width">
      {notes.map((note, index) => (
        <article className="note-row" key={note.slug}>
          <span>0{index + 1}</span>
          <div>
            <p>{noteStatusLabels[locale][note.status]}</p>
            <h3>
              {note.status === "published" ? (
                <Link href={`/notes/${note.slug}`}>{note.title[locale]}</Link>
              ) : (
                note.title[locale]
              )}
            </h3>
            <p>{note.summary[locale]}</p>
          </div>
          <time dateTime={note.date}>{note.date}</time>
        </article>
      ))}
    </div>
  );
}
