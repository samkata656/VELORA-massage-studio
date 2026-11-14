import "server-only";
import { db } from "../db";
import { enqueue } from "../webhooks/outbox";
import { ROTA_WEEKS_AHEAD } from "../config";
import {
  addDays,
  type DateKey,
  instantToKey,
  keyToUtcDate,
  mondayOf,
  rangeKeys,
  todayKey,
  utcDateToKey,
  weekday,
} from "../time";
import {
  coverageByDay,
  generateRota,
  validateRota,
  type ExtraShiftRequest,
  type RotaWarning,
  type RuleViolation,
  type TherapistDays,
} from "../scheduling/rota";
import { resolveTherapist, type ScheduleChange } from "../scheduling/changes";
import type { AbsenceType, ShiftSource } from "@/generated/prisma/client";

export async function activeTherapists() {
  return db.therapist.findMany({ where: { active: true, deletedAt: null }, orderBy: { createdAt: "asc" } });
}

export async function loadShifts(from: DateKey, to: DateKey): Promise<TherapistDays> {
  const rows = await db.shift.findMany({ where: { date: { gte: keyToUtcDate(from), lte: keyToUtcDate(to) } } });
  const map: TherapistDays = new Map();
  for (const r of rows) {
    if (!map.has(r.therapistId)) map.set(r.therapistId, new Set());
    map.get(r.therapistId)!.add(utcDateToKey(r.date));
  }
  return map;
}

export async function loadAbsences(from: DateKey, to: DateKey) {
  const rows = await db.absence.findMany({
    where: { fromDate: { lte: keyToUtcDate(to) }, toDate: { gte: keyToUtcDate(from) } },
    orderBy: { fromDate: "asc" },
  });
  const days: TherapistDays = new Map();
  const typeByDay = new Map<string, AbsenceType>();
  for (const a of rows) {
    const s = utcDateToKey(a.fromDate) < from ? from : utcDateToKey(a.fromDate);
    const e = utcDateToKey(a.toDate) > to ? to : utcDateToKey(a.toDate);
    if (!days.has(a.therapistId)) days.set(a.therapistId, new Set());
    for (const k of rangeKeys(s, e)) {
      days.get(a.therapistId)!.add(k);
      typeByDay.set(`${a.therapistId}|${k}`, a.type);
    }
  }
  return { rows, days, typeByDay };
}

async function bookedDays(from: DateKey, to: DateKey): Promise<TherapistDays> {
  const allocs = await db.appointmentAllocation.findMany({
    where: {
      active: true,
      appointment: { status: "BOOKED" },
      startsAt: { gte: keyToUtcDate(addDays(from, -1)), lte: keyToUtcDate(addDays(to, 1)) },
    },
    select: { therapistId: true, startsAt: true },
  });
  const map: TherapistDays = new Map();
  for (const a of allocs) {
    const k = instantToKey(a.startsAt);
    if (k < from || k > to) continue;
    if (!map.has(a.therapistId)) map.set(a.therapistId, new Set());
    map.get(a.therapistId)!.add(k);
  }
  return map;
}

/** Generates shifts for upcoming weeks that have none yet (keeps the rota 8 weeks ahead). */
export async function ensureRotaAhead(weeksAhead = ROTA_WEEKS_AHEAD) {
  const therapists = await activeTherapists();
  if (!therapists.length) return 0;
  const firstMonday = mondayOf(todayKey());
  const lastDay = addDays(firstMonday, weeksAhead * 7 - 1);
  const existing = await loadShifts(addDays(firstMonday, -7), addDays(lastDay, 7));
  const emptyWeeks: DateKey[] = [];
  for (let w = 0; w < weeksAhead; w++) {
    const m = addDays(firstMonday, w * 7);
    const days = new Set(rangeKeys(m, addDays(m, 6)));
    const any = [...existing.values()].some((s) => [...s].some((k) => days.has(k)));
    if (!any) emptyWeeks.push(m);
  }
  if (!emptyWeeks.length) return 0;
  const { days: absences } = await loadAbsences(emptyWeeks[0], addDays(emptyWeeks.at(-1)!, 6));
  const result = generateRota({
    therapistIds: therapists.map((t) => t.id),
    weekStarts: emptyWeeks,
    existing,
    absences,
    lockedBefore: todayKey(),
  });
  const data = [...result.shifts].flatMap(([therapistId, days]) =>
    [...days].filter((k) => k >= todayKey()).map((k) => ({ therapistId, date: keyToUtcDate(k), source: "AUTO" as ShiftSource })),
  );
  if (data.length) await db.shift.createMany({ data, skipDuplicates: true });
  return emptyWeeks.length;
}

export interface PreviewAbsence {
  therapistId: string;
  therapistName: string;
  from: DateKey;
  to: DateKey;
  type: AbsenceType;
  note?: string;
}

export interface RotaPreview {
  weeks: DateKey[];
  absences: PreviewAbsence[];
  added: { therapistId: string; date: DateKey }[];
  removed: { therapistId: string; date: DateKey }[];
  warnings: RotaWarning[];
  issues: string[];
  /** after-state for each therapist, generated weeks only */
  after: Record<string, DateKey[]>;
}

function defaultExtraRange(today: DateKey): { from: DateKey; to: DateKey } {
  const sunday = addDays(mondayOf(today), 6);
  // late in the week → also allow next week
  return { from: today, to: weekday(today) >= 4 ? addDays(sunday, 7) : sunday };
}

/** Turns admin/AI changes into a rota preview. Nothing is written. */
export async function buildPreview(changes: ScheduleChange[]): Promise<RotaPreview> {
  const therapists = await activeTherapists();
  const today = todayKey();
  const issues: string[] = [];
  const forcedOff: TherapistDays = new Map();
  const forcedOn: TherapistDays = new Map();
  const extras: ExtraShiftRequest[] = [];
  const newAbsences: PreviewAbsence[] = [];
  const touched: DateKey[] = [];
  const add = (m: TherapistDays, id: string, k: DateKey) => {
    if (!m.has(id)) m.set(id, new Set());
    m.get(id)!.add(k);
  };

  for (const c of changes) {
    const t = resolveTherapist(c.therapist, therapists);
    if (!t) {
      issues.push(`Unknown therapist "${c.therapist}".`);
      continue;
    }
    if (c.type === "absence") {
      let from = c.from;
      const to = c.to < c.from ? c.from : c.to;
      if (to < today) {
        issues.push(`${t.name}: absence ${c.from}–${c.to} is in the past and was ignored.`);
        continue;
      }
      if (from < today) from = today;
      newAbsences.push({ therapistId: t.id, therapistName: t.name, from, to, type: c.absenceType, note: c.note });
      touched.push(from, to);
    } else if (c.type === "extra_shifts") {
      const range = c.from && c.to ? { from: c.from < today ? today : c.from, to: c.to } : defaultExtraRange(today);
      extras.push({ therapistId: t.id, count: c.count, from: range.from, to: range.to });
      touched.push(range.from, range.to);
    } else if (c.type === "day_off") {
      if (c.date < today) continue;
      add(forcedOff, t.id, c.date);
      touched.push(c.date);
    } else if (c.type === "add_shift") {
      if (c.date < today) continue;
      add(forcedOn, t.id, c.date);
      touched.push(c.date);
    }
  }

  if (!touched.length) return { weeks: [], absences: newAbsences, added: [], removed: [], warnings: [], issues, after: {} };

  const firstWeek = mondayOf(touched.reduce((a, b) => (a < b ? a : b)));
  const lastWeek = mondayOf(touched.reduce((a, b) => (a > b ? a : b)));
  const weeks: DateKey[] = [];
  for (let m = firstWeek; m <= lastWeek && weeks.length < 26; m = addDays(m, 7)) weeks.push(m);
  const rangeFrom = weeks[0];
  const rangeTo = addDays(weeks.at(-1)!, 6);

  const existing = await loadShifts(addDays(rangeFrom, -7), addDays(rangeTo, 7));
  const { days: absences } = await loadAbsences(addDays(rangeFrom, -7), addDays(rangeTo, 7));
  for (const a of newAbsences) for (const k of rangeKeys(a.from, a.to)) add(absences, a.therapistId, k);
  const booked = await bookedDays(rangeFrom, rangeTo);

  const result = generateRota({
    therapistIds: therapists.map((t) => t.id),
    weekStarts: weeks,
    existing,
    absences,
    forcedOff,
    forcedOn,
    extraShifts: extras,
    lockedBefore: today,
    bookedDays: booked,
  });

  const added: RotaPreview["added"] = [];
  const removed: RotaPreview["removed"] = [];
  const after: Record<string, DateKey[]> = {};
  for (const t of therapists) {
    const before = existing.get(t.id) ?? new Set();
    const next = result.shifts.get(t.id) ?? new Set();
    after[t.id] = [...next].sort();
    for (const k of rangeKeys(rangeFrom, rangeTo)) {
      if (k < today) continue;
      if (next.has(k) && !before.has(k)) added.push({ therapistId: t.id, date: k });
      if (!next.has(k) && before.has(k)) removed.push({ therapistId: t.id, date: k });
    }
  }
  return { weeks, absences: newAbsences, added, removed, warnings: result.warnings, issues, after };
}

export async function applyPreview(preview: RotaPreview, source: ShiftSource) {
  const today = todayKey();
  await db.$transaction(async (tx) => {
    for (const a of preview.absences) {
      // Same request sent twice → keep one record. A same-type absence that already covers the
      // whole range makes the new one redundant.
      const covered = await tx.absence.findFirst({
        where: { therapistId: a.therapistId, type: a.type, fromDate: { lte: keyToUtcDate(a.from) }, toDate: { gte: keyToUtcDate(a.to) } },
      });
      if (covered) continue;
      await tx.absence.create({
        data: { therapistId: a.therapistId, fromDate: keyToUtcDate(a.from), toDate: keyToUtcDate(a.to), type: a.type, note: a.note },
      });
    }
    for (const r of preview.removed) {
      if (r.date < today) continue;
      await tx.shift.deleteMany({ where: { therapistId: r.therapistId, date: keyToUtcDate(r.date) } });
    }
    const add = preview.added.filter((a) => a.date >= today);
    if (add.length)
      await tx.shift.createMany({
        data: add.map((a) => ({ therapistId: a.therapistId, date: keyToUtcDate(a.date), source })),
        skipDuplicates: true,
      });
    if (preview.weeks.length)
      await enqueue(tx, "rota.updated", {
        weeks: preview.weeks,
        added: preview.added,
        removed: preview.removed,
        absences: preview.absences.map((a) => ({ ...a })),
      });
  });
}

/**
 * Re-balances the rota from this week to the horizon (e.g. after a therapist joins or leaves),
 * changing as few published shifts as possible.
 */
export async function rebalanceRota() {
  const therapists = await activeTherapists();
  const today = todayKey();
  const firstMonday = mondayOf(today);
  const weeks = Array.from({ length: ROTA_WEEKS_AHEAD }, (_, i) => addDays(firstMonday, i * 7));
  const last = addDays(weeks.at(-1)!, 6);
  const existing = await loadShifts(addDays(firstMonday, -7), addDays(last, 7));
  const { days: absences } = await loadAbsences(addDays(firstMonday, -7), addDays(last, 7));
  const booked = await bookedDays(firstMonday, last);
  const result = generateRota({
    therapistIds: therapists.map((t) => t.id),
    weekStarts: weeks,
    existing,
    absences,
    lockedBefore: today,
    bookedDays: booked,
  });
  const preview: RotaPreview = { weeks, absences: [], added: [], removed: [], warnings: result.warnings, issues: [], after: {} };
  for (const t of therapists) {
    const before = existing.get(t.id) ?? new Set();
    const next = result.shifts.get(t.id) ?? new Set();
    for (const k of rangeKeys(today, last)) {
      if (next.has(k) && !before.has(k)) preview.added.push({ therapistId: t.id, date: k });
      if (!next.has(k) && before.has(k)) preview.removed.push({ therapistId: t.id, date: k });
    }
  }
  await applyPreview(preview, "AUTO");
  return preview;
}

export interface ToggleResult {
  ok: boolean;
  violations: RuleViolation[];
}

/** Manual add/remove of one shift, validated against the rota rules. */
export async function toggleShift(therapistId: string, dateKey: DateKey, force = false): Promise<ToggleResult> {
  const from = addDays(mondayOf(dateKey), -7);
  const to = addDays(mondayOf(dateKey), 13);
  const shifts = await loadShifts(from, to);
  const { days: absences } = await loadAbsences(from, to);
  const mine = new Set(shifts.get(therapistId) ?? []);
  const adding = !mine.has(dateKey);
  if (adding) mine.add(dateKey);
  else mine.delete(dateKey);
  const violations = validateRota(new Map([[therapistId, mine]]), absences, from, to).filter((v) => {
    // only report problems that involve the edited week (neighbouring weeks may be partial)
    if (v.type === "NO_WEEKLY_REST") return v.weekStart === mondayOf(dateKey);
    if (v.type === "WORKS_WHILE_ABSENT") return v.date === dateKey;
    return v.from <= dateKey && v.to >= dateKey;
  });
  if (violations.length && !force) return { ok: false, violations };
  if (adding) await db.shift.create({ data: { therapistId, date: keyToUtcDate(dateKey), source: "MANUAL" } });
  else await db.shift.deleteMany({ where: { therapistId, date: keyToUtcDate(dateKey) } });
  return { ok: true, violations };
}

export async function weekView(monday: DateKey) {
  const days = rangeKeys(monday, addDays(monday, 6));
  const therapists = await activeTherapists();
  const shifts = await loadShifts(addDays(monday, -7), addDays(monday, 13));
  const { days: absences, typeByDay, rows: absenceRows } = await loadAbsences(addDays(monday, -7), addDays(monday, 13));
  const coverage = coverageByDay(
    new Map(therapists.map((t) => [t.id, shifts.get(t.id) ?? new Set<DateKey>()])),
    days,
  );
  const violations = validateRota(
    new Map(therapists.map((t) => [t.id, shifts.get(t.id) ?? new Set<DateKey>()])),
    absences,
    addDays(monday, -7),
    addDays(monday, 13),
  ).filter((v) => (v.type === "NO_WEEKLY_REST" ? v.weekStart === monday : v.type === "WORKS_WHILE_ABSENT" ? days.includes(v.date) : v.to >= monday && v.from <= days[6]));
  return { days, therapists, shifts, absences, typeByDay, absenceRows, coverage, violations };
}
