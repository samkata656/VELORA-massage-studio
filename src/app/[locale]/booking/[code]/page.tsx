import Link from "next/link";
import type { Metadata } from "next";
import { formatDateTime, formatPrice, pick, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { getCurrentUser } from "@/lib/auth";
import { authorize, canClientChange, type ManageAuth } from "@/lib/services/booking";
import { BOOKING_HORIZON_DAYS } from "@/lib/config";
import { addDays, todayKey } from "@/lib/time";
import { ManageBooking } from "./ManageBooking";

export const metadata: Metadata = { robots: { index: false } };

export default async function BookingPage({ params, searchParams }: PageProps<"/[locale]/booking/[code]">) {
  const { locale: l, code } = await params;
  const locale = l as Locale;
  const token = (await searchParams).t;
  const t = getDictionary(locale);
  const user = await getCurrentUser();

  const auth: ManageAuth | null =
    user?.role === "ADMIN" ? { admin: true } : typeof token === "string" ? { token } : user ? { userId: user.id } : null;
  const appt = auth ? await authorize(code, auth).catch(() => null) : null;

  if (!appt) {
    return (
      <div className="container-x py-24 text-center">
        <h1 className="text-4xl">{t.manage.title}</h1>
        <p className="mx-auto mt-4 max-w-md text-muted">{t.manage.invalid}</p>
        <Link href={`/${locale}`} className="btn btn-ghost mt-8">
          {t.errors.goHome}
        </Link>
      </div>
    );
  }

  const changeable = canClientChange(appt) || user?.role === "ADMIN";
  const today = todayKey();
  const dates = Array.from({ length: BOOKING_HORIZON_DAYS + 1 }, (_, i) => addDays(today, i));
  const statusStyles: Record<string, string> = {
    BOOKED: "bg-olive-soft text-olive",
    COMPLETED: "bg-sand text-espresso",
    CANCELLED: "bg-danger-soft text-danger",
    NO_SHOW: "bg-warn-soft text-warn",
  };

  return (
    <div className="container-x max-w-3xl py-14 md:py-20">
      <p className="eyebrow">{t.booking.code} · {appt.code}</p>
      <h1 className="mt-3 text-5xl">{t.manage.title}</h1>
      <div className="card mt-10 p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl">{pick(appt.procedure, "name", locale)}</h2>
            <p className="mt-1 text-muted">
              {formatDateTime(appt.startsAt, locale)} · {appt.variant.durationMin} {t.treatments.minutes}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm ${statusStyles[appt.status]}`}>{t.status[appt.status]}</span>
        </div>
        <dl className="mt-6 grid gap-4 border-t border-line pt-6 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">{t.booking.chooseTherapist}</dt>
            <dd className="mt-1">{appt.allocations.map((a) => a.therapist.name).join(", ")}</dd>
          </div>
          <div>
            <dt className="text-muted">{t.booking.room}</dt>
            <dd className="mt-1">{appt.allocations.map((a) => a.room.name).join(", ")}</dd>
          </div>
          <div>
            <dt className="text-muted">€</dt>
            <dd className="mt-1 font-display text-xl">{formatPrice(appt.priceCents, locale)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-8">
        {appt.status === "BOOKED" && changeable ? (
          <ManageBooking locale={locale} t={t} code={appt.code} token={typeof token === "string" ? token : undefined} variantId={appt.variantId} dates={dates} />
        ) : appt.status === "BOOKED" ? (
          <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">{t.manage.tooLate}</p>
        ) : null}
      </div>
    </div>
  );
}
