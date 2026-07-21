import Link from "next/link";

import styles from "@/components/reports/public-report.module.css";

export default function PublicReportNotFound() {
  return (
    <main className={styles.notFound}>
      <header className={styles.notFoundHeader}>
        <Link href="/zh/evidence" className={styles.reportBrand}>
          <span aria-hidden="true">E/</span>
          <strong>Evidence Graph</strong>
        </Link>
      </header>
      <section className={styles.notFoundBody}>
        <p>Evidence Graph</p>
        <h1>报告不可用</h1>
        <p>报告可能尚未发布，或已经由项目所有者撤销。</p>
        <Link href="/zh/evidence">返回 Evidence Graph</Link>
      </section>
    </main>
  );
}
