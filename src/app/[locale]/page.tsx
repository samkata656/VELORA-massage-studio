import Image from "next/image";
import Link from "next/link";
import { formatPrice, pick, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { getActiveProcedures, minPrice } from "@/lib/services/catalog";
import { STUDIO } from "@/lib/config";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = (await params).locale as Locale;
  const t = getDictionary(locale);
  const [procedures, user] = await Promise.all([getActiveProcedures(), getCurrentUser()]);
  const featured = procedures.slice(0, 6);

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <Image src="/photos/lobby.png" alt="" fill priority sizes="100vw" className="-z-10 object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#2e2620]/80 via-[#2e2620]/45 to-transparent" />
        <div className="container-x flex min-h-[78svh] flex-col justify-end pb-16 pt-28 md:justify-center md:pb-24">
          <div className="fade-up max-w-xl text-linen">
            <p className="eyebrow !text-[#e6cfa9]">{t.home.eyebrow}</p>
            <h1 className="mt-5 text-[2.6rem] leading-[1.05] md:text-[4.2rem]">{t.home.title}</h1>
            <p className="mt-6 max-w-md text-lg font-light text-[#f1e8dc]">{t.home.lead}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href={`/${locale}/book`} className="btn btn-accent">
                {t.home.ctaBook}
              </Link>
              <Link href={`/${locale}/treatments`} className="btn border border-white/40 text-linen hover:bg-white/10">
                {t.home.ctaTreatments}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Intro */}
      <section className="container-x grid gap-12 py-20 md:grid-cols-2 md:py-28">
        <div>
          <h2 className="text-4xl leading-tight md:text-5xl">{t.home.introTitle}</h2>
          <p className="mt-6 max-w-lg text-lg font-light leading-relaxed text-muted">{t.home.introText}</p>
        </div>
        <dl className="grid grid-cols-3 gap-4 self-end border-t border-line pt-8">
          {t.home.stats.map((s) => (
            <div key={s.label}>
              <dt className="sr-only">{s.label}</dt>
              <dd className="font-display text-5xl text-bronze-deep">{s.value}</dd>
              <dd className="mt-2 text-sm text-muted">{s.label}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Treatments */}
      <section className="bg-linen py-20 md:py-28">
        <div className="container-x">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h2 className="text-4xl md:text-5xl">{t.home.treatmentsTitle}</h2>
              <p className="mt-3 max-w-lg text-muted">{t.home.treatmentsLead}</p>
            </div>
            <Link href={`/${locale}/treatments`} className="btn btn-ghost">
              {t.home.viewAll}
            </Link>
          </div>
          <ul className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p) => (
              <li key={p.id} className="flex flex-col bg-linen p-7">
                <h3 className="text-2xl">{pick(p, "name", locale)}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{pick(p, "summary", locale)}</p>
                <div className="mt-6 flex items-baseline justify-between">
                  <span className="text-sm text-muted">
                    {p.variants.map((v) => v.durationMin).join(" / ")} {t.treatments.minutes}
                  </span>
                  <span className="font-display text-xl text-bronze-deep">
                    {t.home.from} {formatPrice(minPrice(p), locale)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Rooms */}
      <section className="container-x py-20 md:py-28">
        <h2 className="text-4xl md:text-5xl">{t.home.roomsTitle}</h2>
        <p className="mt-3 max-w-xl text-muted">{t.home.roomsLead}</p>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            ["room-olive", "Olive"],
            ["room-linen", "Linen"],
            ["room-amber", "Amber"],
          ].map(([file, name], i) => (
            <figure key={file} className={`group overflow-hidden rounded-3xl ${i === 1 ? "md:translate-y-10" : ""}`}>
              <div className="relative aspect-[4/5]">
                <Image
                  src={`/photos/${file}.png`}
                  alt={`VELORA — ${name}`}
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                />
              </div>
              <figcaption className="mt-3 font-display text-xl">{name}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Account CTA */}
      {!user && (
        <section className="container-x pt-10">
          <div className="card flex flex-col items-start gap-6 p-8 md:flex-row md:items-center md:justify-between md:p-12">
            <div className="max-w-xl">
              <h2 className="text-3xl md:text-4xl">{t.home.accountTitle}</h2>
              <p className="mt-3 text-muted">{t.home.accountText}</p>
            </div>
            <Link href={`/${locale}/register`} className="btn btn-primary">
              {t.home.accountCta}
            </Link>
          </div>
        </section>
      )}

      {/* Contact */}
      <section id="contact" className="container-x scroll-mt-24 pt-20">
        <div className="grid gap-10 md:grid-cols-[1fr_1.2fr] md:items-center">
          <div>
            <h2 className="text-4xl md:text-5xl">{t.contact.title}</h2>
            <p className="mt-3 text-muted">{t.contact.hours}</p>
            <dl className="mt-8 space-y-5">
              <div>
                <dt className="eyebrow">{t.contact.phone}</dt>
                <dd className="mt-1 text-lg">
                  <a href={STUDIO.phoneHref} className="hover:text-bronze-deep">
                    {STUDIO.phone}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="eyebrow">{t.contact.email}</dt>
                <dd className="mt-1 text-lg">
                  <a href={`mailto:${STUDIO.email}`} className="hover:text-bronze-deep">
                    {STUDIO.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="eyebrow">{t.contact.address}</dt>
                <dd className="mt-1 text-lg">{locale === "bg" ? STUDIO.addressBg : STUDIO.addressEn}</dd>
              </div>
            </dl>
          </div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-3xl">
            <Image src="/photos/room-amber.png" alt="" fill sizes="(min-width: 768px) 55vw, 100vw" className="object-cover" />
          </div>
        </div>
      </section>
    </>
  );
}
