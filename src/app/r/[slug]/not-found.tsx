import Link from "next/link";

export default function PublicReportNotFound() {
  return (
    <main
      style={{
        display: "grid",
        minHeight: "100svh",
        padding: "32px",
        placeContent: "center",
        textAlign: "center",
      }}
    >
      <p style={{ margin: 0, color: "#686d65", fontSize: "12px" }}>Evidence Graph</p>
      <h1 style={{ margin: "8px 0", fontSize: "30px" }}>报告不可用</h1>
      <p style={{ margin: 0, color: "#555c54" }}>
        报告可能尚未发布或已经撤销。 Report unavailable or revoked.
      </p>
      <Link
        href="/zh/evidence"
        style={{ marginTop: "20px", color: "#8f2f26", fontWeight: 700 }}
      >
        返回 Evidence Graph
      </Link>
    </main>
  );
}
