import Link from "next/link";
import type { Metadata } from "next";
import { pick, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { db } from "@/lib/db";

export async function generateMetadata({ params }: PageProps<"/[locale]/benefits">): Promise<Metadata> {
  return { title: getDictionary((await params).locale as Locale).benefits.title };
}

export default async function BenefitsPage({ params }: PageProps<"/[locale]/benefits">) {
  const locale = (await params).locale as Locale;
  const t = getDictionary(locale);
  // Only articles of active procedures are shown; n8n creates/deletes them as procedures change.
  const procedures = await db.procedure.findMany({
    where: { active: true, deletedAt: null },
    orderBy: { sort: "asc" },
    include: { article: true },
  });

  return (
    <div className="container-x py-16 md:py-24">
      <header className="max-w-2xl">
        <h1 className="text-5xl md:text-6xl">{t.benefits.title}</h1>
        <p className="mt-4 text-lg font-light text-muted">{t.benefits.lead}</p>
      </header>
      <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {procedures.map((p, i) => (
          <li key={p.id}>
            {p.article ? (
              <Link
                href={`/${locale}/benefits/${p.slug}`}
                className="card group flex h-full flex-col p-7 transition-colors duration-200 hover:border-oak"
              >
                <span className="font-display text-sm text-bronze-deep">{String(i + 1).padStart(2, "0")}</span>
                <h2 className="mt-3 text-2xl leading-snug">{pick(p.article, "title", locale)}</h2>
                <p className="mt-3 flex-1 text-sm text-muted">{pick(p, "summary", locale)}</p>
                <span className="mt-6 text-sm font-medium text-bronze-deep">{pick(p, "name", locale)} →</span>
              </Link>
            ) : (
              <div className="card flex h-full flex-col border-dashed p-7">
                <span className="font-display text-sm text-muted">{String(i + 1).padStart(2, "0")}</span>
                <h2 className="mt-3 text-2xl leading-snug">{pick(p, "name", locale)}</h2>
                <p className="mt-3 text-sm text-muted">{t.benefits.comingSoon}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
