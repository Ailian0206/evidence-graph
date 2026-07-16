import { ExternalLink, FileText } from "lucide-react";
import { useTranslations } from "next-intl";

import type { EvidenceLink, Source } from "@/features/research/domain";
import type { AppLocale } from "@/i18n/routing";

import styles from "./evidence-workspace.module.css";

export function WorkspaceSourceViewer({
  locale,
  evidence,
  source,
  mobileActive,
}: {
  locale: AppLocale;
  evidence?: EvidenceLink;
  source?: Source;
  mobileActive: boolean;
}) {
  const t = useTranslations("Workspace");

  return (
    <aside
      id="workspace-panel-source"
      className={`${styles.panel} ${styles.sourcePanel}`}
      aria-labelledby="workspace-tab-source"
      data-testid="workspace-source"
      data-mobile-active={mobileActive}
      role="tabpanel"
    >
      <header className={styles.panelHeader}>
        <div>
          <p>{t("panels.source")}</p>
          <h2 id="source-title">{source?.title ?? t("noSource")}</h2>
        </div>
        <FileText aria-hidden="true" size={19} />
      </header>
      {evidence && source ? (
        <div className={styles.sourceBody}>
          <span className={styles.sourceDomain}>{source.domain}</span>
          <span className={styles.relationBadge} data-relation={evidence.relation}>
            {t(`relation.${evidence.relation}`)} · {t(`strength.${evidence.strength}`)}
          </span>
          <blockquote>{evidence.quote}</blockquote>
          <p>{evidence.rationale}</p>
          <dl>
            <div>
              <dt>{t("sourceMeta.title")}</dt>
              <dd>{source.title}</dd>
            </div>
            <div>
              <dt>{t("sourceMeta.author")}</dt>
              <dd>{source.author ?? t("sourceMeta.unknown")}</dd>
            </div>
            <div>
              <dt>{t("sourceMeta.retrieved")}</dt>
              <dd>
                {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                  new Date(source.retrievedAt),
                )}
              </dd>
            </div>
            <div>
              <dt>{t("sourceMeta.url")}</dt>
              <dd>{source.canonicalUrl}</dd>
            </div>
          </dl>
          <a
            className={styles.sourceLink}
            href={source.canonicalUrl}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink aria-hidden="true" size={16} />
            {t("openSource")}
          </a>
        </div>
      ) : (
        <p className={styles.emptySource}>{t("noSource")}</p>
      )}
    </aside>
  );
}
