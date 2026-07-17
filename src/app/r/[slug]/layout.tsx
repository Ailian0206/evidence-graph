import "../../globals.css";

import { loadPublicReport } from "./report-loader";

export default async function PublicReportLayout({
  children,
  params,
}: LayoutProps<"/r/[slug]">) {
  const { slug } = await params;
  const report = await loadPublicReport(slug);

  return (
    <html lang={report?.language ?? "zh"}>
      <body>{children}</body>
    </html>
  );
}
