type ProductLayoutProps = {
  children: React.ReactNode;
};

export default function ProductLayout({ children }: ProductLayoutProps) {
  return (
    <main id="main-content" tabIndex={-1}>
      {children}
    </main>
  );
}
