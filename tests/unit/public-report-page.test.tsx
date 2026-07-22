import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadPublicReport: vi.fn(async () => ({ title: "Published report" })),
}));

vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
vi.mock("@/components/reports/public-report", () => ({
  PublicReport: () => null,
}));
vi.mock("@/app/r/[slug]/report-loader", () => ({
  loadPublicReport: mocks.loadPublicReport,
}));

import PublicReportPage, * as publicReportPageModule from "@/app/r/[slug]/page";

describe("public report page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not opt runtime report slugs into static generation", () => {
    expect(publicReportPageModule).not.toHaveProperty("generateStaticParams");
  });

  it("loads a published report by its runtime slug", async () => {
    await PublicReportPage({
      params: Promise.resolve({ slug: "runtime-report" }),
    });

    expect(mocks.loadPublicReport).toHaveBeenCalledWith("runtime-report");
  });
});
