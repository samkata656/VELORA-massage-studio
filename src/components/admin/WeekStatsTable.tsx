import type { weekStats } from "@/lib/services/stats";
import { eur } from "./ui";

export function WeekStatsTable({ stats }: { stats: Awaited<ReturnType<typeof weekStats>> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-muted">
          <tr className="border-b border-line">
            <th className="py-2.5 pr-3 font-medium">Therapist</th>
            <th className="px-3 py-2.5 text-right font-medium">Shifts worked</th>
            <th className="px-3 py-2.5 text-right font-medium">Scheduled</th>
            <th className="px-3 py-2.5 text-right font-medium">Absent days</th>
            <th className="px-3 py-2.5 text-right font-medium">Appointments</th>
            <th className="py-2.5 pl-3 text-right font-medium">Expected revenue</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {stats.rows.map((r) => (
            <tr key={r.therapistId}>
              <td className="py-3 pr-3">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} aria-hidden="true" />
                  {r.name}
                </span>
              </td>
              <td className="px-3 py-3 text-right tabular-nums">{r.workedShifts}</td>
              <td className="px-3 py-3 text-right tabular-nums">{r.scheduledShifts}</td>
              <td className="px-3 py-3 text-right tabular-nums">{r.absenceDays || "—"}</td>
              <td className="px-3 py-3 text-right tabular-nums">{r.appointments}</td>
              <td className="py-3 pl-3 text-right font-medium tabular-nums">{eur(r.revenueCents)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-espresso/30 font-medium">
            <td className="py-3 pr-3">Studio total</td>
            <td className="px-3 py-3 text-right tabular-nums">{stats.totals.workedShifts}</td>
            <td className="px-3 py-3 text-right tabular-nums">{stats.totals.scheduledShifts}</td>
            <td className="px-3 py-3" />
            <td className="px-3 py-3 text-right tabular-nums">{stats.totals.appointments}</td>
            <td className="py-3 pl-3 text-right tabular-nums">{eur(stats.totals.revenueCents)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-3 text-xs text-muted">Revenue = booked + completed appointments this week; a couples massage is split between its two therapists.</p>
    </div>
  );
}
