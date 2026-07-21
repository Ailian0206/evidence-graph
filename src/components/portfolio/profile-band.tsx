import { ArrowUpRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { profile } from "@/content/profile";
import type { AppLocale } from "@/i18n/routing";

export async function ProfileBand() {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("Portfolio");

  return (
    <section className="profile-band">
      <div className="content-width profile-band-inner">
        <p className="section-index">{t("sections.about")}</p>
        <div>
          <h2>{profile.focus[locale]}</h2>
          <p>{profile.role[locale]}</p>
        </div>
        <a className="text-action" href={`mailto:${profile.email}`}>
          {t("contact")}
          <ArrowUpRight aria-hidden="true" size={18} />
        </a>
      </div>
    </section>
  );
}
