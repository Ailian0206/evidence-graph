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

  it("leaves the product main landmark to the product shell", () => {
    render(
      <ProductLayout>
        <p>Product content</p>
      </ProductLayout>,
    );

    expect(screen.queryByRole("main")).toBeNull();
    expect(screen.getByText("Product content")).toBeVisible();
    expect(screen.queryByText("Portfolio navigation")).toBeNull();
    expect(screen.queryByText("Portfolio footer")).toBeNull();
  });
});
