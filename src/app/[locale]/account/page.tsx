import Link from "next/link";
import type { Metadata } from "next";
import { formatDateTime, formatPrice, pick, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function generateMetadata({ params }: PageProps<"/[locale]/account">): Promise<Metadata> {
  return { title: getDictionary((await params).locale as Locale).account.title, robots: { index: false } };
}

export default async function AccountPage({ params }: PageProps<"/[locale]/account">) {
  const locale = (await params).locale as Locale;
  const t = getDictionary(locale);
  const user = await requireUser(locale);
  const appointments = await db.appointment.findMany({
    where: { OR: [{ userId: user.id }, { guestEmail: user.email }] },
    include: { procedure: true, variant: true, allocations: { include: { therapist: true } } },
    orderBy: { startsAt: "desc" },
  });
  const now = new Date();
  const upcoming = appointments.filter((a) => a.status === "BOOKED" && a.startsAt >= now).reverse();
  const history = appointments.filter((a) => !(a.status === "BOOKED" && a.startsAt >= now));

  return (
    <div className="container-x py-14 md:py-20">
      <p className="eyebrow">
        {t.account.hello}, {user.name.split(" ")[0]}
      </p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-5xl md:text-6xl">{t.account.title}</h1>
        <Link href={`/${locale}/book`} className="btn btn-primary">
          {t.account.bookNew}
        </Link>
      </div>

      <section className="mt-12">
        <h2 className="text-3xl">{t.account.upcoming}</h2>
        {upcoming.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-line px-5 py-8 text-center text-muted">{t.account.none}</p>
        ) : (
          <ul className="mt-5 grid gap-4 md:grid-cols-2">
            {upcoming.map((a) => (
              <li key={a.id} className="card flex flex-col p-6">
                <p className="text-sm text-bronze-deep">{formatDateTime(a.startsAt, locale)}</p>
                <h3 className="mt-2 text-2xl">{pick(a.procedure, "name", locale)}</h3>
                <p className="mt-1 text-sm text-muted">
                  {a.variant.durationMin} {t.treatments.minutes} · {a.allocations.map((x) => x.therapist.name).join(", ")} · {formatPrice(a.priceCents, locale)}
                </p>
                <Link href={`/${locale}/booking/${a.code}`} className="btn btn-ghost btn-sm mt-5 self-start">
                  {t.account.manage}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-14">
        <h2 className="text-3xl">{t.account.history}</h2>
        {history.length === 0 ? (
          <p className="mt-4 text-muted">{t.account.noneHistory}</p>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-linen text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">{t.booking.stepDate}</th>
                  <th className="px-4 py-3 font-medium">{t.booking.stepTreatment}</th>
                  <th className="px-4 py-3 font-medium">{t.booking.chooseTherapist}</th>
                  <th className="px-4 py-3 font-medium">{t.manage.status}</th>
                  <th className="px-4 py-3 text-right font-medium">€</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-white/50">
                {history.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap px-4 py-3">{formatDateTime(a.startsAt, locale)}</td>
                    <td className="px-4 py-3">
                      {pick(a.procedure, "name", locale)} · {a.variant.durationMin} {t.treatments.minutes}
                    </td>
                    <td className="px-4 py-3">{a.allocations.map((x) => x.therapist.name).join(", ")}</td>
                    <td className="px-4 py-3">{t.status[a.status === "BOOKED" ? "COMPLETED" : a.status]}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatPrice(a.priceCents, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
