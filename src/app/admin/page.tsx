import Link from "next/link";
import { db } from "@/lib/db";
import { appointmentsNeedingAttention } from "@/lib/services/booking";
import { ensureRotaAhead } from "@/lib/services/rota";
import { weekStats } from "@/lib/services/stats";
import { addDays, fmtMinutes, instantToMinutes, instantToKey, isoWeekLabel, localToInstant, mondayOf, todayKey } from "@/lib/time";
import { PageHeader, Panel, Stat, WeekNav, eur, shortDay } from "@/components/admin/ui";
import { WeekStatsTable } from "@/components/admin/WeekStatsTable";
import { ReassignButton } from "@/components/admin/ReassignButton";

export default async function Dashboard({ searchParams }: PageProps<"/admin">) {
  await ensureRotaAhead();
  const today = todayKey();
  const sp = await searchParams;
  const monday = typeof sp.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? mondayOf(sp.week) : mondayOf(today);

  const [todayAppts, stats, attention] = await Promise.all([
    db.appointment.findMany({
      where: { startsAt: { gte: localToInstant(today, 0), lt: localToInstant(addDays(today, 1), 0) }, status: { not: "CANCELLED" } },
      include: { procedure: true, variant: true, allocations: { include: { therapist: true, room: true } } },
      orderBy: { startsAt: "asc" },
    }),
    weekStats(monday),
    appointmentsNeedingAttention(),
  ]);
  const todayRevenue = todayAppts.reduce((s, a) => s + a.priceCents, 0);
  const nowMin = instantToMinutes(new Date());
  const next = todayAppts.find((a) => instantToMinutes(a.startsAt) >= nowMin && a.status === "BOOKED");

  return (
    <>
      <PageHeader title="Good day" lead={`${shortDay(today)} · ${isoWeekLabel(today)}`}>
        <Link href="/admin/appointments?new=1" className="btn btn-primary btn-sm">
          New appointment
        </Link>
        <Link href="/admin/schedule" className="btn btn-ghost btn-sm">
          Today’s schedule
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Appointments today" value={todayAppts.length} />
        <Stat label="Expected today" value={eur(todayRevenue)} />
        <Stat label="Next guest" value={next ? fmtMinutes(instantToMinutes(next.startsAt)) : "—"} sub={next ? `${next.guestName} · ${next.procedure.nameEn}` : "No more guests today"} />
        <Stat label="This week" value={eur(stats.totals.revenueCents)} sub={`${stats.totals.appointments} appointments`} />
      </div>

      {attention.length > 0 && (
        <Panel title="Needs attention" className="mt-6 !border-[#e8c9a0] !bg-warn-soft/60">
          <p className="mb-3 text-sm text-muted">These bookings are assigned to a therapist who is off or absent that day.</p>
          <ul className="divide-y divide-line/70">
            {attention.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span>
                  <strong className="font-medium">{shortDay(instantToKey(a.startsAt))}</strong> {fmtMinutes(instantToMinutes(a.startsAt))} · {a.appointment.procedure.nameEn} ·{" "}
                  {a.appointment.guestName} — <span className="text-danger">{a.therapist.name}</span>
                </span>
                <ReassignButton allocationId={a.id} />
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Week overview" action={<WeekNav monday={monday} basePath="/admin" today={today} />}>
          <WeekStatsTable stats={stats} />
        </Panel>

        <Panel title="Today" action={<Link href="/admin/schedule" className="text-sm text-bronze-deep hover:underline">Open timeline →</Link>}>
          {todayAppts.length === 0 ? (
            <p className="text-sm text-muted">No appointments today.</p>
          ) : (
            <ul className="divide-y divide-line">
              {todayAppts.map((a) => (
                <li key={a.id} className="flex items-start gap-4 py-3 text-sm">
                  <span className="w-12 shrink-0 font-medium tabular-nums">{fmtMinutes(instantToMinutes(a.startsAt))}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{a.procedure.nameEn}</span>
                    <span className="block truncate text-muted">
                      {a.guestName} · {a.allocations.map((x) => `${x.therapist.name.split(" ")[0]} / ${x.room.name}`).join(", ")}
                    </span>
                  </span>
                  <span className="text-muted tabular-nums">{a.variant.durationMin}′</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

    </>
  );
}
