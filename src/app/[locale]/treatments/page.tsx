import Link from "next/link";
import type { Metadata } from "next";
import { formatPrice, pick, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { getActiveProcedures } from "@/lib/services/catalog";

export async function generateMetadata({ params }: PageProps<"/[locale]/treatments">): Promise<Metadata> {
  return { title: getDictionary((await params).locale as Locale).treatments.title };
}

export default async function TreatmentsPage({ params }: PageProps<"/[locale]/treatments">) {
  const locale = (await params).locale as Locale;
  const t = getDictionary(locale);
  const procedures = await getActiveProcedures();

  return (
    <div className="container-x py-16 md:py-24">
      <header className="max-w-2xl">
        <h1 className="text-5xl md:text-6xl">{t.treatments.title}</h1>
        <p className="mt-4 text-lg font-light text-muted">{t.treatments.lead}</p>
      </header>

      <ul className="mt-14 divide-y divide-line border-y border-line">
        {procedures.map((p) => (
          <li key={p.id} className="grid gap-5 py-9 md:grid-cols-[1.3fr_1fr_auto] md:items-center md:gap-10">
            <div>
              <h2 className="text-3xl">{pick(p, "name", locale)}</h2>
              <p className="mt-2 max-w-md text-muted">{pick(p, "summary", locale)}</p>
              {p.therapistsRequired > 1 && <p className="chip mt-3">{t.treatments.therapists2}</p>}
            </div>
            <ul className="flex flex-wrap gap-2">
              {p.variants.map((v) => (
                <li key={v.id} className="rounded-2xl border border-line bg-linen px-4 py-2.5">
                  <span className="text-sm text-muted">
                    {v.durationMin} {t.treatments.minutes}
                  </span>
                  <span className="ml-3 font-display text-xl text-espresso">{formatPrice(v.priceCents, locale)}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              {p.article && (
                <Link href={`/${locale}/benefits/${p.slug}`} className="btn btn-ghost btn-sm">
                  {t.treatments.readBenefits}
                </Link>
              )}
              <Link href={`/${locale}/book?procedure=${p.slug}`} className="btn btn-primary btn-sm">
                {t.treatments.book}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
