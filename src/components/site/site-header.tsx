"use client";

import { Code2, Languages, Menu, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { profile } from "@/content/profile";
import { Link, usePathname } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

export function SiteHeader() {
  const t = useTranslations("Navigation");
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const alternateLocale: AppLocale = locale === "zh" ? "en" : "zh";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const navigationItems = [
    { href: "/" as const, label: t("home") },
    { href: "/work" as const, label: t("work") },
    { href: "/notes" as const, label: t("notes") },
    { href: "/evidence" as const, label: t("evidence") },
    { href: "/app" as const, label: t("workspace") },
  ];
  const isCurrent = (href: (typeof navigationItems)[number]["href"]) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      setMenuOpen(false);
      requestAnimationFrame(() => menuButtonRef.current?.focus());
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  return (
    <header className="site-header">
      <Link className="brand-link" href="/" aria-label={`${profile.brand} home`}>
        <span className="brand-mark" aria-hidden="true">
          A/
        </span>
        <span>{profile.brand}</span>
      </Link>
      <nav
        id="primary-navigation"
        className="primary-nav"
        aria-label={t("primary")}
        data-open={menuOpen}
      >
        {navigationItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isCurrent(item.href) ? "page" : undefined}
            onClick={() => setMenuOpen(false)}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="header-actions">
        <Link
          className="icon-action"
          href={pathname}
          locale={alternateLocale}
          aria-label={t("language")}
          title={t("language")}
        >
          <Languages aria-hidden="true" size={18} />
        </Link>
        <a
          className="icon-action github-action"
          href={profile.githubUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub"
          title="GitHub"
        >
          <Code2 aria-hidden="true" size={18} />
        </a>
        <button
          ref={menuButtonRef}
          className="menu-toggle"
          type="button"
          aria-controls="primary-navigation"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? t("closeMenu") : t("openMenu")}
          title={menuOpen ? t("closeMenu") : t("openMenu")}
          onClick={() => setMenuOpen((current) => !current)}
        >
          {menuOpen ? (
            <X aria-hidden="true" size={19} />
          ) : (
            <Menu aria-hidden="true" size={19} />
          )}
        </button>
      </div>
    </header>
  );
}
