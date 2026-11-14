import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { BUFFER_MIN, LUNCH_MIN, SHIFT_END, SHIFT_START } from "@/lib/config";
import { placeLunch } from "@/lib/scheduling/availability";
import { addDays, fmtMinutes, instantToMinutes, keyToUtcDate, localToInstant, todayKey } from "@/lib/time";
import { PageHeader, Panel, shortDay } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Day schedule" };

const SPAN = SHIFT_END - SHIFT_START;
const pct = (m: number) => `${((m - SHIFT_START) / SPAN) * 100}%`;
const width = (a: number, b: number) => `${((b - a) / SPAN) * 100}%`;
const hours = Array.from({ length: SPAN / 60 + 1 }, (_, i) => SHIFT_START + i * 60);

export default async function SchedulePage({ searchParams }: PageProps<"/admin/schedule">) {
  const sp = await searchParams;
  const today = todayKey();
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const dayStart = localToInstant(date, 0);
  const dayEnd = localToInstant(addDays(date, 1), 0);

  const [therapists, shifts, absences, rooms, appointments] = await Promise.all([
    db.therapist.findMany({ where: { deletedAt: null, active: true }, orderBy: { createdAt: "asc" } }),
    db.shift.findMany({ where: { date: keyToUtcDate(date) } }),
    db.absence.findMany({ where: { fromDate: { lte: keyToUtcDate(date) }, toDate: { gte: keyToUtcDate(date) } } }),
    db.room.findMany({ orderBy: { sort: "asc" } }),
    db.appointment.findMany({
      where: { startsAt: { gte: dayStart, lt: dayEnd }, status: { not: "CANCELLED" } },
      include: { procedure: true, variant: true, allocations: true },
      orderBy: { startsAt: "asc" },
    }),
  ]);
  const onShift = new Set(shifts.map((s) => s.therapistId));
  const absentType = new Map(absences.map((a) => [a.therapistId, a.type]));
  const working = therapists.filter((t) => onShift.has(t.id) && !absentType.has(t.id));
  const off = therapists.filter((t) => !working.includes(t));

  type Block = { id: string; start: number; end: number; title: string; sub: string; status: string; color: string };
  const blocksFor = (pred: (a: (typeof appointments)[number]["allocations"][number]) => boolean, colorOf: (a: (typeof appointments)[number]["allocations"][number]) => string) =>
    appointments.flatMap((appt) =>
      appt.allocations.filter(pred).map(
        (al): Block => ({
          id: appt.id,
          start: instantToMinutes(appt.startsAt),
          end: instantToMinutes(appt.endsAt),
          title: appt.procedure.nameEn,
          sub: `${appt.guestName} · ${rooms.find((r) => r.id === al.roomId)?.name ?? ""}${appt.allocations.length > 1 ? " · couples" : ""}`,
          status: appt.status,
          color: colorOf(al),
        }),
      ),
    );

  const Lane = ({ label, sub, blocks, lunch }: { label: React.ReactNode; sub?: string; blocks: Block[]; lunch?: number | null }) => (
    <div className="grid grid-cols-[120px_1fr] items-stretch gap-3 md:grid-cols-[160px_1fr]">
      <div className="py-2">
        <div className="truncate text-sm font-medium">{label}</div>
        {sub && <div className="text-xs text-muted">{sub}</div>}
      </div>
      <div className="relative h-16 rounded-xl border border-line bg-white/60">
        {hours.slice(1, -1).map((h) => (
          <span key={h} className="absolute inset-y-0 border-l border-dashed border-line" style={{ left: pct(h) }} aria-hidden="true" />
        ))}
        {lunch != null && (
          <span
            className="absolute inset-y-1.5 flex items-center justify-center rounded-lg bg-olive-soft text-[0.7rem] text-olive"
            style={{ left: pct(lunch), width: width(lunch, lunch + LUNCH_MIN) }}
            title={`Lunch ${fmtMinutes(lunch)}–${fmtMinutes(lunch + LUNCH_MIN)}`}
          >
            Lunch
          </span>
        )}
        {blocks.map((b, i) => (
          <span key={`${b.id}-${i}`}>
            <Link
              href={`/admin/appointments?date=${date}#a-${b.id}`}
              className={`absolute inset-y-1.5 overflow-hidden rounded-lg px-2 py-1 text-[0.7rem] leading-tight text-white shadow-sm transition-transform hover:-translate-y-px ${b.status === "NO_SHOW" ? "opacity-50" : ""}`}
              style={{ left: pct(b.start), width: width(b.start, b.end), background: b.color }}
              title={`${fmtMinutes(b.start)}–${fmtMinutes(b.end)} ${b.title} — ${b.sub}`}
            >
              <span className="block truncate font-medium">
                {fmtMinutes(b.start)} {b.title}
              </span>
              <span className="block truncate opacity-85">{b.sub}</span>
            </Link>
            <span className="hatch absolute inset-y-1.5 rounded-r-lg" style={{ left: pct(b.end), width: width(b.end, Math.min(SHIFT_END + BUFFER_MIN, b.end + BUFFER_MIN)) }} title="Rest & room preparation" aria-hidden="true" />
          </span>
        ))}
      </div>
    </div>
  );

  const roomColors = ["#8C6A43", "#6E7350", "#B07D62"];

  return (
    <>
      <PageHeader title="Day schedule" lead={`${shortDay(date)} — therapists work 10:00–19:00 · 20 min rest/prep after each treatment · 30 min lunch between 12:00 and 14:00`}>
        <Link href={`/admin/schedule?date=${addDays(date, -1)}`} className="btn btn-ghost btn-sm" aria-label="Previous day">
          ←
        </Link>
        <form className="flex items-center gap-2">
          <label htmlFor="date" className="sr-only">
            Date
          </label>
          <input id="date" name="date" type="date" defaultValue={date} className="input !min-h-9 !w-auto !py-1 text-sm" />
          <button className="btn btn-ghost btn-sm">Go</button>
        </form>
        <Link href={`/admin/schedule?date=${addDays(date, 1)}`} className="btn btn-ghost btn-sm" aria-label="Next day">
          →
        </Link>
        {date !== today && (
          <Link href="/admin/schedule" className="btn btn-ghost btn-sm">
            Today
          </Link>
        )}
        <Link href={`/admin/appointments?new=1&date=${date}`} className="btn btn-primary btn-sm">
          New appointment
        </Link>
      </PageHeader>

      <Panel title="Therapists">
        <div className="overflow-x-auto">
          <div className="min-w-[760px] space-y-2">
            <div className="grid grid-cols-[120px_1fr] gap-3 md:grid-cols-[160px_1fr]">
              <span />
              <div className="relative h-5 text-[0.7rem] text-muted">
                {hours.map((h) => (
                  <span key={h} className="absolute -translate-x-1/2 tabular-nums" style={{ left: pct(h) }}>
                    {fmtMinutes(h)}
                  </span>
                ))}
              </div>
            </div>
            {working.length === 0 && <p className="py-6 text-sm text-muted">Nobody is scheduled on this day.</p>}
            {working.map((t) => {
              const blocks = blocksFor((al) => al.therapistId === t.id, () => t.color);
              const lunch = placeLunch(blocks.map((b) => ({ start: b.start, end: b.end + BUFFER_MIN })));
              return <Lane key={t.id} label={t.name} sub={`${blocks.length} treatment${blocks.length === 1 ? "" : "s"}`} blocks={blocks} lunch={lunch} />;
            })}
          </div>
        </div>
        {off.length > 0 && (
          <p className="mt-4 text-sm text-muted">
            Off today:{" "}
            {off.map((t, i) => (
              <span key={t.id}>
                {i > 0 && ", "}
                {t.name}
                {absentType.has(t.id) && <span className="text-danger"> ({absentType.get(t.id)!.replace("_", " ").toLowerCase()})</span>}
              </span>
            ))}
          </p>
        )}
      </Panel>

      <Panel title="Rooms" className="mt-6">
        <div className="overflow-x-auto">
          <div className="min-w-[760px] space-y-2">
            {rooms.map((r, i) => (
              <Lane key={r.id} label={r.name} blocks={blocksFor((al) => al.roomId === r.id, () => roomColors[i % roomColors.length])} />
            ))}
          </div>
        </div>
      </Panel>
    </>
  );
}
