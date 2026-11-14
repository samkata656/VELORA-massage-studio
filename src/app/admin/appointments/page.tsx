import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { addDays, fmtMinutes, instantToMinutes, localToInstant, todayKey } from "@/lib/time";
import { PageHeader, Panel, eur, shortDay } from "@/components/admin/ui";
import { ReassignButton } from "@/components/admin/ReassignButton";
import { AdminBookingForm } from "./AdminBookingForm";
import { RowActions } from "./RowActions";
import type { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Appointments" };

const statusChip: Record<string, string> = {
  BOOKED: "!text-olive",
  COMPLETED: "!text-espresso",
  CANCELLED: "!text-danger line-through",
  NO_SHOW: "!text-warn",
};
const sourceLabel: Record<string, string> = { WEB: "Website", ADMIN: "Admin", AI: "AI chat" };

export default async function AppointmentsPage({ searchParams }: PageProps<"/admin/appointments">) {
  const sp = await searchParams;
  const today = todayKey();
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const showNew = sp.new === "1";

  const where: Prisma.AppointmentWhereInput = q
    ? {
        OR: [
          { code: { contains: q, mode: "insensitive" } },
          { guestName: { contains: q, mode: "insensitive" } },
          { guestEmail: { contains: q, mode: "insensitive" } },
          { guestPhone: { contains: q } },
        ],
      }
    : { startsAt: { gte: localToInstant(date, 0), lt: localToInstant(addDays(date, 1), 0) } };

  const [appointments, procedures, therapists] = await Promise.all([
    db.appointment.findMany({
      where,
      include: { procedure: true, variant: true, allocations: { include: { therapist: true, room: true } } },
      orderBy: { startsAt: q ? "desc" : "asc" },
      take: 200,
    }),
    db.procedure.findMany({
      where: { active: true, deletedAt: null },
      orderBy: { sort: "asc" },
      include: { variants: { where: { active: true }, orderBy: { durationMin: "asc" } } },
    }),
    db.therapist.findMany({ where: { active: true, deletedAt: null }, orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Appointments" lead={q ? `Search results for “${q}”` : shortDay(date)}>
        <form className="flex flex-wrap items-center gap-2">
          <label htmlFor="q" className="sr-only">
            Search
          </label>
          <input id="q" name="q" defaultValue={q} placeholder="Name, email, phone or code" className="input !min-h-9 !w-56 !py-1 text-sm" />
          <label htmlFor="adate" className="sr-only">
            Date
          </label>
          <input id="adate" name="date" type="date" defaultValue={date} className="input !min-h-9 !w-auto !py-1 text-sm" />
          <button className="btn btn-ghost btn-sm">Show</button>
        </form>
        {!q && (
          <>
            <Link href={`/admin/appointments?date=${addDays(date, -1)}`} className="btn btn-ghost btn-sm" aria-label="Previous day">
              ←
            </Link>
            <Link href={`/admin/appointments?date=${addDays(date, 1)}`} className="btn btn-ghost btn-sm" aria-label="Next day">
              →
            </Link>
          </>
        )}
        <Link href={`/admin/appointments?date=${date}${showNew ? "" : "&new=1"}`} className="btn btn-primary btn-sm">
          {showNew ? "Close form" : "New appointment"}
        </Link>
      </PageHeader>

      {showNew && (
        <Panel title="New appointment" className="mb-6">
          <AdminBookingForm
            initialDate={date < today ? today : date}
            therapists={therapists.map((t) => ({ id: t.id, name: t.name }))}
            procedures={procedures.map((p) => ({
              id: p.id,
              name: p.nameEn,
              therapistsRequired: p.therapistsRequired,
              variants: p.variants.map((v) => ({ id: v.id, durationMin: v.durationMin, price: eur(v.priceCents) })),
            }))}
          />
        </Panel>
      )}

      <Panel>
        {appointments.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No appointments {q ? "match your search" : "on this day"}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted">
                <tr className="border-b border-line">
                  <th className="py-2.5 pr-3 font-medium">When</th>
                  <th className="px-3 py-2.5 font-medium">Treatment</th>
                  <th className="px-3 py-2.5 font-medium">Client</th>
                  <th className="px-3 py-2.5 font-medium">Therapist / room</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 text-right font-medium">Price</th>
                  <th className="py-2.5 pl-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {appointments.map((a) => (
                  <tr key={a.id} id={`a-${a.id}`} className="scroll-mt-24 align-top target:bg-warn-soft/50">
                    <td className="py-3 pr-3">
                      <div className="font-medium tabular-nums">
                        {fmtMinutes(instantToMinutes(a.startsAt))}–{fmtMinutes(instantToMinutes(a.endsAt))}
                      </div>
                      {q && <div className="text-xs text-muted">{shortDay(a.startsAt.toISOString().slice(0, 10))}</div>}
                      <div className="text-xs tracking-wider text-muted">{a.code}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div>{a.procedure.nameEn}</div>
                      <div className="text-xs text-muted">
                        {a.variant.durationMin} min · {sourceLabel[a.source]}
                        {a.therapistChosen && " · therapist requested"}
                      </div>
                      {a.notes && <div className="mt-1 max-w-56 text-xs italic text-muted">“{a.notes}”</div>}
                    </td>
                    <td className="px-3 py-3">
                      <div>{a.guestName}</div>
                      <div className="text-xs text-muted">{a.guestPhone}</div>
                      <div className="text-xs text-muted">{a.guestEmail}</div>
                    </td>
                    <td className="px-3 py-3">
                      {a.allocations.map((al) => (
                        <div key={al.id} className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: al.therapist.color }} aria-hidden="true" />
                          <span>
                            {al.therapist.name} · {al.room.name}
                          </span>
                          {a.status === "BOOKED" && a.startsAt > new Date() && <ReassignButton allocationId={al.id} label="Swap" />}
                        </div>
                      ))}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`chip ${statusChip[a.status]}`}>{a.status.replace("_", " ").toLowerCase()}</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{eur(a.priceCents)}</td>
                    <td className="py-3 pl-3">
                      <RowActions id={a.id} code={a.code} status={a.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
