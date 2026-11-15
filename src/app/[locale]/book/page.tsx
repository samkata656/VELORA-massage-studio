import type { Metadata } from "next";
import { pick, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { getCurrentUser } from "@/lib/auth";
import { getActiveProcedures, getBookableTherapists } from "@/lib/services/catalog";
import { BOOKING_HORIZON_DAYS } from "@/lib/config";
import { addDays, todayKey } from "@/lib/time";
import { BookingWizard } from "./BookingWizard";
import { turnstileSiteKey } from "@/lib/turnstile";

export async function generateMetadata({ params }: PageProps<"/[locale]/book">): Promise<Metadata> {
  return { title: getDictionary((await params).locale as Locale).booking.title };
}

export default async function BookPage({ params, searchParams }: PageProps<"/[locale]/book">) {
  const locale = (await params).locale as Locale;
  const { procedure: slug } = await searchParams;
  const t = getDictionary(locale);
  const [procedures, user] = await Promise.all([getActiveProcedures(), getCurrentUser()]);
  const therapists = user ? await getBookableTherapists() : null;
  const today = todayKey();
  const dates = Array.from({ length: BOOKING_HORIZON_DAYS + 1 }, (_, i) => addDays(today, i));

  return (
    <div className="container-x py-14 md:py-20">
      <h1 className="mb-10 text-5xl md:text-6xl">{t.booking.title}</h1>
      <BookingWizard
        locale={locale}
        t={t}
        dates={dates}
        turnstileSiteKey={turnstileSiteKey()}
        initialSlug={typeof slug === "string" ? slug : undefined}
        user={user ? { name: user.name, email: user.email, phone: user.phone } : null}
        procedures={procedures
          .filter((p) => p.variants.length)
          .map((p) => ({
            id: p.id,
            slug: p.slug,
            name: pick(p, "name", locale),
            summary: pick(p, "summary", locale),
            therapistsRequired: p.therapistsRequired,
            variants: p.variants.map((v) => ({ id: v.id, durationMin: v.durationMin, priceCents: v.priceCents })),
          }))}
        therapists={
          therapists?.map((x) => ({
            id: x.id,
            name: x.name,
            title: pick(x, "title", locale),
            procedureIds: x.skills.map((s) => s.procedureId),
          })) ?? null
        }
      />
    </div>
  );
}
