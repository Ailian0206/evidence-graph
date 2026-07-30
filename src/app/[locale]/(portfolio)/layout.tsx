import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

type PortfolioLayoutProps = {
  children: React.ReactNode;
};

export default function PortfolioLayout({ children }: PortfolioLayoutProps) {
  return (
    <div className="site-shell">
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
