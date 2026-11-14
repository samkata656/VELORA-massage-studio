import "server-only";
import { db } from "../db";
import { addDays, type DateKey, keyToUtcDate, localToInstant, todayKey, utcDateToKey } from "../time";
import { activeTherapists, loadAbsences } from "./rota";

export interface TherapistWeekStats {
  therapistId: string;
  name: string;
  color: string;
  scheduledShifts: number;
  workedShifts: number;
  absenceDays: number;
  appointments: number;
  revenueCents: number;
}

/**
 * Per-therapist figures for the week starting `monday`:
 * - scheduled shifts, shifts already worked (days up to today),
 * - expected revenue = price of BOOKED + COMPLETED appointments
 *   (a couples massage is split equally between its two therapists).
 */
export async function weekStats(monday: DateKey) {
  const sunday = addDays(monday, 6);
  const today = todayKey();
  const therapists = await activeTherapists();
  const [shifts, absences, allocations] = await Promise.all([
    db.shift.findMany({ where: { date: { gte: keyToUtcDate(monday), lte: keyToUtcDate(sunday) } } }),
    loadAbsences(monday, sunday),
    db.appointmentAllocation.findMany({
      where: {
        startsAt: { gte: localToInstant(monday, 0), lt: localToInstant(addDays(sunday, 1), 0) },
        appointment: { status: { in: ["BOOKED", "COMPLETED"] } },
      },
      include: { appointment: { include: { allocations: { select: { id: true } } } } },
    }),
  ]);

  const rows: TherapistWeekStats[] = therapists.map((t) => {
    const mine = shifts.filter((s) => s.therapistId === t.id);
    const allocs = allocations.filter((a) => a.therapistId === t.id);
    return {
      therapistId: t.id,
      name: t.name,
      color: t.color,
      scheduledShifts: mine.length,
      workedShifts: mine.filter((s) => utcDateToKey(s.date) <= today).length,
      absenceDays: absences.days.get(t.id)?.size ?? 0,
      appointments: allocs.length,
      revenueCents: Math.round(allocs.reduce((sum, a) => sum + a.appointment.priceCents / Math.max(1, a.appointment.allocations.length), 0)),
    };
  });

  const appointmentIds = new Set(allocations.map((a) => a.appointmentId));
  const totalRevenue = [...new Map(allocations.map((a) => [a.appointmentId, a.appointment.priceCents])).values()].reduce((a, b) => a + b, 0);
  return {
    rows,
    totals: {
      scheduledShifts: rows.reduce((a, r) => a + r.scheduledShifts, 0),
      workedShifts: rows.reduce((a, r) => a + r.workedShifts, 0),
      appointments: appointmentIds.size,
      revenueCents: totalRevenue,
    },
  };
}
