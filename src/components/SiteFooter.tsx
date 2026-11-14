import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n";
import { STUDIO } from "@/lib/config";
import { Wordmark } from "./Logo";

export function SiteFooter({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <footer className="mt-24 border-t border-line bg-linen">
      <div className="container-x grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-4">
          <Wordmark />
          <p className="max-w-xs text-sm text-muted">{t.footer.tagline}</p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="eyebrow mb-3">{t.contact.title}</p>
          <p>{locale === "bg" ? STUDIO.addressBg : STUDIO.addressEn}</p>
          <p>
            <a href={STUDIO.phoneHref} className="hover:text-bronze-deep">
              {STUDIO.phone}
            </a>
          </p>
          <p>
            <a href={`mailto:${STUDIO.email}`} className="hover:text-bronze-deep">
              {STUDIO.email}
            </a>
          </p>
          <p className="text-muted">{t.contact.hours}</p>
        </div>
        <nav aria-label="Footer" className="flex flex-col gap-2 text-sm">
          <p className="eyebrow mb-3">VELORA</p>
          <Link href={`/${locale}/treatments`} className="hover:text-bronze-deep">
            {t.nav.treatments}
          </Link>
          <Link href={`/${locale}/benefits`} className="hover:text-bronze-deep">
            {t.nav.benefits}
          </Link>
          <Link href={`/${locale}/book`} className="hover:text-bronze-deep">
            {t.nav.book}
          </Link>
          <Link href={`/${locale}/account`} className="hover:text-bronze-deep">
            {t.nav.account}
          </Link>
        </nav>
      </div>
      <div className="border-t border-line">
        <div className="container-x flex flex-wrap items-center justify-between gap-2 py-5 text-xs text-muted">
          <span>
            © {new Date().getFullYear()} VELORA. {t.footer.rights}
          </span>
          <span>{STUDIO.instagram}</span>
        </div>
      </div>
    </footer>
  );
}
