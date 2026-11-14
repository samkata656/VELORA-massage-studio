import Link from "next/link";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n";
import type { CurrentUser } from "@/lib/auth";
import { Wordmark } from "./Logo";
import { LocaleSwitch } from "./LocaleSwitch";
import { logoutAction } from "@/app/[locale]/(auth)/actions";

export function SiteHeader({ locale, t, user }: { locale: Locale; t: Dictionary; user: CurrentUser | null }) {
  const links = [
    { href: `/${locale}/treatments`, label: t.nav.treatments },
    { href: `/${locale}/benefits`, label: t.nav.benefits },
    { href: `/${locale}#contact`, label: t.nav.contact },
  ];
  const accountLink = user
    ? user.role === "ADMIN"
      ? { href: "/admin", label: t.nav.admin }
      : { href: `/${locale}/account`, label: t.nav.account }
    : { href: `/${locale}/login`, label: t.nav.login };

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-cream/90 backdrop-blur-sm">
      <div className="container-x flex h-[72px] items-center justify-between gap-4">
        <Link href={`/${locale}`} aria-label="VELORA" className="shrink-0">
          <Wordmark />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full px-4 py-2 text-[0.95rem] text-muted transition-colors hover:text-espresso">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-1 lg:flex">
          <Suspense>
            <LocaleSwitch locale={locale} label={t.nav.language} />
          </Suspense>
          <Link href={accountLink.href} className="rounded-full px-3 py-2 text-sm text-muted transition-colors hover:text-espresso">
            {accountLink.label}
          </Link>
          {user && (
            <form action={logoutAction}>
              <input type="hidden" name="locale" value={locale} />
              <button className="rounded-full px-3 py-2 text-sm text-muted transition-colors hover:text-espresso">{t.nav.logout}</button>
            </form>
          )}
          <Link href={`/${locale}/book`} className="btn btn-primary ml-2">
            {t.nav.book}
          </Link>
        </div>

        <details className="group relative lg:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-line px-4 text-sm [&::-webkit-details-marker]:hidden">
            {t.nav.menu}
            <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true">
              <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </summary>
          <div className="absolute right-0 mt-2 w-[min(88vw,320px)] rounded-2xl border border-line bg-linen p-3 shadow-soft">
            <nav aria-label="Mobile" className="flex flex-col">
              {[...links, accountLink].map((l) => (
                <Link key={l.href} href={l.href} className="rounded-xl px-3 py-3 text-base hover:bg-cream">
                  {l.label}
                </Link>
              ))}
              {user && (
                <form action={logoutAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <button className="w-full rounded-xl px-3 py-3 text-left text-base hover:bg-cream">{t.nav.logout}</button>
                </form>
              )}
              <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
                <Suspense>
                  <LocaleSwitch locale={locale} label={t.nav.language} />
                </Suspense>
                <Link href={`/${locale}/book`} className="btn btn-primary btn-sm">
                  {t.nav.book}
                </Link>
              </div>
            </nav>
          </div>
        </details>
      </div>
    </header>
  );
}
