import { ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { profile } from "@/content/profile";

export async function SiteFooter() {
  const t = await getTranslations("Footer");

  return (
    <footer className="site-footer">
      <p>{t("statement")}</p>
      <div>
        <a href={`mailto:${profile.email}`}>
          {profile.email}
          <ArrowUpRight aria-hidden="true" size={15} />
        </a>
        <a href={profile.githubUrl} target="_blank" rel="noreferrer">
          GitHub
          <ArrowUpRight aria-hidden="true" size={15} />
        </a>
      </div>
    </footer>
  );
}
