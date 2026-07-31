import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import PublicResearchCasePage, {
  dynamic,
  dynamicParams,
  generateMetadata,
  generateStaticParams,
} from "@/app/[locale]/(portfolio)/notes/[slug]/page";
import { publicResearchCases } from "@/content/public-research-cases";

afterEach(cleanup);

describe("public research case page", () => {
  it("pre-renders exactly the three C5 case slugs", () => {
    expect(dynamic).toBe("force-static");
    expect(dynamicParams).toBe(false);
    expect(generateStaticParams()).toEqual(
      publicResearchCases.map((researchCase) => ({ slug: researchCase.slug })),
    );
  });

  it("renders localized case evidence, correction, and report navigation", async () => {
    const researchCase = publicResearchCases[0];
    const element = await PublicResearchCasePage({
      params: Promise.resolve({ locale: "en", slug: researchCase.slug }),
    });
    render(element);

    expect(screen.getByRole("heading", { name: researchCase.title.en })).toBeVisible();
    expect(screen.getByText(researchCase.failure.correction.en)).toBeVisible();
    expect(screen.getByRole("link", { name: "Open cited report" })).toHaveAttribute(
      "href",
      `/r/${researchCase.reportSlug}`,
    );
    await expect(
      generateMetadata({
        params: Promise.resolve({ locale: "en", slug: researchCase.slug }),
      }),
    ).resolves.toMatchObject({
      title: researchCase.title.en,
      description: researchCase.summary.en,
    });
  });

  it("returns not found for an unknown case", async () => {
    await expect(
      PublicResearchCasePage({
        params: Promise.resolve({ locale: "zh", slug: "missing-case" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
