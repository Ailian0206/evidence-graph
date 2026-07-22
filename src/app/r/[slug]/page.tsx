import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicReport } from "@/components/reports/public-report";

import { loadPublicReport } from "./report-loader";

export async function generateMetadata({
  params,
}: PageProps<"/r/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const report = await loadPublicReport(slug);

  if (!report) {
    notFound();
  }

  return {
    metadataBase: new URL("https://evidence-graph.vercel.app"),
    title: report.title,
    description: report.question,
    alternates: { canonical: `/r/${slug}` },
    openGraph: {
      type: "article",
      url: `/r/${slug}`,
      title: report.title,
      description: report.question,
      publishedTime: report.report.publishedAt,
    },
  };
}

export default async function PublicReportPage({ params }: PageProps<"/r/[slug]">) {
  const { slug } = await params;
  const report = await loadPublicReport(slug);

  if (!report) {
    notFound();
  }

  return <PublicReport report={report} />;
}
