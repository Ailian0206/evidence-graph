import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PortfolioLayout from "@/app/[locale]/(portfolio)/layout";
import ProductLayout from "@/app/[locale]/(product)/layout";

vi.mock("@/components/site/site-footer", () => ({
  SiteFooter: () => <footer>Portfolio footer</footer>,
}));

vi.mock("@/components/site/site-header", () => ({
  SiteHeader: () => <header>Portfolio navigation</header>,
}));

afterEach(cleanup);

describe("locale route shells", () => {
  it("keeps the personal site chrome on portfolio routes", () => {
    render(
      <PortfolioLayout>
        <p>Portfolio content</p>
      </PortfolioLayout>,
    );

    expect(screen.getByRole("banner")).toHaveTextContent("Portfolio navigation");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("contentinfo")).toHaveTextContent("Portfolio footer");
  });

  it("renders product routes without the personal site chrome", () => {
    render(
      <ProductLayout>
        <p>Product content</p>
      </ProductLayout>,
    );

    expect(screen.getByRole("main")).toHaveTextContent("Product content");
    expect(screen.queryByText("Portfolio navigation")).toBeNull();
    expect(screen.queryByText("Portfolio footer")).toBeNull();
  });
});
