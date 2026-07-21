"use client";

import { Copy, ExternalLink, Printer } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";

import type { PublicReport as PublicReportData } from "@/features/reports/report-store";

import styles from "./public-report.module.css";

const copy = {
  zh: {
    snapshot: "公开研究快照",
    published: "发布于",
    version: "版本",
    copy: "复制公开链接",
    print: "打印报告",
    copied: "链接已复制",
    copyError: "复制失败",
    citations: "引用来源",
    source: "打开原始来源",
    citation: "查看引用",
  },
  en: {
    snapshot: "Public research snapshot",
    published: "Published",
    version: "Version",
    copy: "Copy public link",
    print: "Print report",
    copied: "Link copied",
    copyError: "Copy failed",
    citations: "Sources",
    source: "Open original source",
    citation: "View citation",
  },
} as const;

const renderParagraph = ({
  text,
  citationNumbers,
  citationLabel,
}: {
  text: string;
  citationNumbers: Map<string, number>;
  citationLabel: string;
}) => {
  const nodes: ReactNode[] = [];
  const citationPattern = /\[([^\]]+)\]/g;
  let cursor = 0;
  let match = citationPattern.exec(text);

  while (match) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }

    const citationId = match[1];
    const citationNumber = citationNumbers.get(citationId);
    nodes.push(
      citationNumber ? (
        <a
          key={`${citationId}-${match.index}`}
          href={`#citation-${citationId}`}
          aria-label={`${citationLabel} ${citationNumber}`}
        >
          [{citationNumber}]
        </a>
      ) : (
        match[0]
      ),
    );
    cursor = citationPattern.lastIndex;
    match = citationPattern.exec(text);
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
};

export function PublicReport({ report }: { report: PublicReportData }) {
  const labels = copy[report.language];
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">("idle");
  const citationNumbers = new Map(
    report.report.citations.map((citation, index) => [citation.evidenceLinkId, index + 1]),
  );
  const publishedDate = new Intl.DateTimeFormat(report.language, {
    dateStyle: "long",
  }).format(new Date(report.report.publishedAt));

  const handleCopy = async () => {
    try {
      if (!navigator.clipboard) {
        throw new Error("CLIPBOARD_UNAVAILABLE");
      }
      await navigator.clipboard.writeText(window.location.href);
      setCopyState("success");
    } catch {
      setCopyState("error");
    }
  };

  return (
    <div className={styles.publicReport} data-testid="public-report">
      <header className={styles.reportHeader}>
        <Link href={`/${report.language}/evidence`} className={styles.reportBrand}>
          <span aria-hidden="true">E/</span>
          <strong>Evidence Graph</strong>
        </Link>
        <div className={styles.reportTools} data-testid="public-report-tools">
          <button type="button" onClick={handleCopy} aria-label={labels.copy} title={labels.copy}>
            <Copy aria-hidden="true" size={17} />
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            aria-label={labels.print}
            title={labels.print}
          >
            <Printer aria-hidden="true" size={17} />
          </button>
          {copyState !== "idle" ? (
            <span role="status">
              {copyState === "success" ? labels.copied : labels.copyError}
            </span>
          ) : null}
        </div>
      </header>

      <main className={styles.reportMain}>
        <header className={styles.reportIntro}>
          <p>{labels.snapshot}</p>
          <h1>{report.title}</h1>
          <strong>{report.question}</strong>
          <dl>
            <div>
              <dt>{labels.version}</dt>
              <dd>{report.report.version}</dd>
            </div>
            <div>
              <dt>{labels.published}</dt>
              <dd>{publishedDate}</dd>
            </div>
          </dl>
        </header>

        <article className={styles.reportBody}>
          {report.report.sections.map((section, sectionIndex) => (
            <section
              key={section.id}
              className={styles.reportSection}
              data-public-report-section="true"
            >
              <span>{String(sectionIndex + 1).padStart(2, "0")}</span>
              <div>
                <h2>{section.heading}</h2>
                {section.markdown.split(/\n\s*\n/).map((paragraph, paragraphIndex) => (
                  <p key={`${section.id}-${paragraphIndex}`}>
                    {renderParagraph({
                      text: paragraph,
                      citationNumbers,
                      citationLabel: labels.citation,
                    })}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </article>

        <section className={styles.reportSources} data-public-citations="true">
          <div>
            <p>Evidence Index</p>
            <h2>{labels.citations}</h2>
          </div>
          <ol aria-label={labels.citations}>
            {report.report.citations.map((citation, index) => (
              <li key={citation.evidenceLinkId} id={`citation-${citation.evidenceLinkId}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{citation.sourceTitle}</h3>
                  <blockquote>{citation.quote}</blockquote>
                  <a
                    href={citation.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${labels.source}：${citation.sourceTitle}`}
                  >
                    {labels.source}
                    <ExternalLink aria-hidden="true" size={14} />
                  </a>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
