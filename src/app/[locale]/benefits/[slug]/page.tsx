import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { formatPrice, pick, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { db } from "@/lib/db";
import { ArticleBody as ArticleText } from "@/components/ArticleBody";

async function load(slug: string) {
  return db.procedure.findFirst({
    where: { slug, active: true, deletedAt: null },
    include: { article: true, variants: { where: { active: true }, orderBy: { durationMin: "asc" } } },
  });
}

export async function generateMetadata({ params }: PageProps<"/[locale]/benefits/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = await load(slug);
  if (!p?.article) return {};
  return { title: pick(p.article, "title", locale as Locale), description: pick(p, "summary", locale as Locale) };
}

const photos = ["room-olive", "room-linen", "room-amber"];

export default async function BenefitArticle({ params }: PageProps<"/[locale]/benefits/[slug]">) {
  const { locale: l, slug } = await params;
  const locale = l as Locale;
  const t = getDictionary(locale);
  const p = await load(slug);
  if (!p?.article) notFound();
  const photo = photos[slug.length % photos.length];

  return (
    <article className="container-x py-14 md:py-20">
      <Link href={`/${locale}/benefits`} className="text-sm text-muted hover:text-espresso">
        ← {t.benefits.back}
      </Link>
      <div className="mt-8 grid gap-12 lg:grid-cols-[1.25fr_1fr]">
        <div>
          <p className="eyebrow">{pick(p, "name", locale)}</p>
          <h1 className="mt-4 text-5xl leading-[1.05] md:text-6xl">{pick(p.article, "title", locale)}</h1>
          <div className="mt-8 max-w-[62ch] text-[1.05rem]">
            <ArticleText text={pick(p.article, "body", locale)} />
          </div>
        </div>
        <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl">
            <Image src={`/photos/${photo}.png`} alt="" fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
          </div>
          <div className="card p-6">
            <ul className="space-y-2">
              {p.variants.map((v) => (
                <li key={v.id} className="flex items-baseline justify-between">
                  <span className="text-muted">
                    {v.durationMin} {t.treatments.minutes}
                  </span>
                  <span className="font-display text-xl">{formatPrice(v.priceCents, locale)}</span>
                </li>
              ))}
            </ul>
            <Link href={`/${locale}/book?procedure=${p.slug}`} className="btn btn-primary mt-6 w-full">
              {t.benefits.bookThis}
            </Link>
          </div>
        </aside>
      </div>
    </article>
  );
}
