import "server-only";
import { db } from "../db";
import { bookingCode, randomToken, sha256 } from "../crypto";
import { enqueue } from "../webhooks/outbox";
import {
  BOOKING_HORIZON_DAYS,
  BUFFER_MIN,
  CANCEL_CUTOFF_HOURS,
  MIN_LEAD_MIN,
} from "../config";
import {
  addDays,
  type DateKey,
  daysBetween,
  fmtMinutes,
  instantToKey,
  instantToMinutes,
  keyToUtcDate,
  localToInstant,
  todayKey,
} from "../time";
import { assignAt, computeSlots, therapistCanTake, type Interval, type RoomDay, type TherapistDay } from "../scheduling/availability";
import type { BookingSource } from "@/generated/prisma/client";

export type BookingErrorCode = "SLOT_TAKEN" | "NOT_FOUND" | "TOO_LATE" | "INVALID" | "FORBIDDEN" | "CANCELLED";

export class BookingError extends Error {
  constructor(
    public code: BookingErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }
}

function isOverlapViolation(e: unknown): boolean {
  const s = String((e as { message?: string })?.message ?? e);
  return s.includes("no_overlap") || s.includes("23P01") || s.includes("exclusion constraint");
}

async function loadVariant(variantId: string) {
  const variant = await db.procedureVariant.findUnique({ where: { id: variantId }, include: { procedure: true } });
  if (!variant || !variant.active || !variant.procedure.active || variant.procedure.deletedAt) throw new BookingError("INVALID", "Unknown treatment");
  return variant;
}

/** Therapists on shift (qualified, not absent) and rooms with their busy intervals for one day. */
export async function loadDayContext(dateKey: DateKey, procedureId: string, excludeAppointmentId?: string) {
  const date = keyToUtcDate(dateKey);
  const dayStart = localToInstant(dateKey, 0);
  const dayEnd = localToInstant(addDays(dateKey, 1), 0);
  const [shifts, absences, allocations, rooms] = await Promise.all([
    db.shift.findMany({
      where: { date, therapist: { active: true, deletedAt: null, skills: { some: { procedureId } } } },
      include: { therapist: true },
    }),
    db.absence.findMany({ where: { fromDate: { lte: date }, toDate: { gte: date } } }),
    db.appointmentAllocation.findMany({
      where: {
        active: true,
        startsAt: { lt: dayEnd },
        blockedUntil: { gt: dayStart },
        ...(excludeAppointmentId ? { appointmentId: { not: excludeAppointmentId } } : {}),
      },
    }),
    db.room.findMany({ orderBy: { sort: "asc" } }),
  ]);
  const absent = new Set(absences.map((a) => a.therapistId));
  const toInterval = (a: { startsAt: Date; blockedUntil: Date }): Interval => ({
    start: instantToMinutes(a.startsAt),
    end: instantToMinutes(a.blockedUntil) || 24 * 60,
  });
  const therapists: (TherapistDay & { name: string })[] = shifts
    .filter((s) => !absent.has(s.therapistId))
    .map((s) => ({
      id: s.therapistId,
      name: s.therapist.name,
      busy: allocations.filter((a) => a.therapistId === s.therapistId).map(toInterval),
    }));
  const roomDays: RoomDay[] = rooms.map((r) => ({ id: r.id, busy: allocations.filter((a) => a.roomId === r.id).map(toInterval) }));
  return { therapists, rooms: roomDays };
}

function validateDate(dateKey: DateKey, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new BookingError("INVALID", "Bad date");
  const diff = daysBetween(todayKey(now), dateKey);
  if (diff < 0 || diff > BOOKING_HORIZON_DAYS) throw new BookingError("INVALID", "Date outside booking window");
}

function notBeforeFor(dateKey: DateKey, now = new Date()) {
  return dateKey === todayKey(now) ? instantToMinutes(now) + MIN_LEAD_MIN : undefined;
}

export interface SlotView {
  start: number;
  label: string;
}

export async function getSlots(opts: {
  variantId: string;
  dateKey: DateKey;
  preferredTherapistId?: string | null;
  excludeAppointmentId?: string;
  ignoreLeadTime?: boolean;
}): Promise<SlotView[]> {
  validateDate(opts.dateKey);
  const variant = await loadVariant(opts.variantId);
  const ctx = await loadDayContext(opts.dateKey, variant.procedureId, opts.excludeAppointmentId);
  return computeSlots({
    durationMin: variant.durationMin,
    therapistsRequired: variant.procedure.therapistsRequired,
    therapists: ctx.therapists,
    rooms: ctx.rooms,
    preferredTherapistId: opts.preferredTherapistId || null,
    notBefore: opts.ignoreLeadTime ? undefined : notBeforeFor(opts.dateKey),
  }).map((s) => ({ start: s.start, label: fmtMinutes(s.start) }));
}

export interface CreateBookingInput {
  variantId: string;
  dateKey: DateKey;
  start: number;
  preferredTherapistId?: string | null;
  userId?: string | null;
  name: string;
  email: string;
  phone: string;
  notes?: string | null;
  source: BookingSource;
  locale?: string;
  /** Admin bookings may be placed for today without the 1h lead time. */
  ignoreLeadTime?: boolean;
}

export async function createBooking(input: CreateBookingInput) {
  validateDate(input.dateKey);
  const variant = await loadVariant(input.variantId);
  const ctx = await loadDayContext(input.dateKey, variant.procedureId);
  const nb = input.ignoreLeadTime ? undefined : notBeforeFor(input.dateKey);
  if (nb !== undefined && input.start < nb) throw new BookingError("SLOT_TAKEN");
  const slot = assignAt(
    {
      durationMin: variant.durationMin,
      therapistsRequired: variant.procedure.therapistsRequired,
      therapists: ctx.therapists,
      rooms: ctx.rooms,
      preferredTherapistId: input.preferredTherapistId || null,
    },
    input.start,
  );
  if (!slot) throw new BookingError("SLOT_TAKEN");

  const startsAt = localToInstant(input.dateKey, slot.start);
  const endsAt = localToInstant(input.dateKey, slot.end);
  const blockedUntil = localToInstant(input.dateKey, slot.end + BUFFER_MIN);
  const cancelToken = randomToken(24);

  try {
    const appointment = await db.$transaction(async (tx) => {
      const appt = await tx.appointment.create({
        data: {
          code: bookingCode(),
          userId: input.userId ?? null,
          guestName: input.name.trim(),
          guestEmail: input.email.trim().toLowerCase(),
          guestPhone: input.phone.trim(),
          procedureId: variant.procedureId,
          variantId: variant.id,
          startsAt,
          endsAt,
          priceCents: variant.priceCents,
          source: input.source,
          therapistChosen: !!input.preferredTherapistId,
          cancelTokenHash: sha256(cancelToken),
          notes: input.notes?.trim() || null,
          locale: input.locale ?? "bg",
          allocations: {
            create: slot.therapistIds.map((therapistId, i) => ({ therapistId, roomId: slot.roomIds[i], startsAt, blockedUntil })),
          },
        },
        include: { allocations: { include: { therapist: true, room: true } }, procedure: true, variant: true },
      });
      await enqueue(tx, "appointment.created", appointmentPayload(appt));
      return appt;
    });
    return { appointment, cancelToken };
  } catch (e) {
    if (isOverlapViolation(e)) throw new BookingError("SLOT_TAKEN");
    throw e;
  }
}

type FullAppointment = Awaited<ReturnType<typeof getAppointmentByCode>> & {};

export function appointmentPayload(a: {
  code: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  priceCents: number;
  source: string;
  locale: string;
  notes?: string | null;
  procedure: { slug: string; nameEn: string; nameBg: string };
  variant: { durationMin: number };
  allocations: { therapist: { id: string; name: string }; room: { id: number; name: string } }[];
}) {
  return {
    code: a.code,
    status: a.status,
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    localDate: instantToKey(a.startsAt),
    localTime: fmtMinutes(instantToMinutes(a.startsAt)),
    durationMin: a.variant.durationMin,
    price: { amount: a.priceCents / 100, currency: "EUR" },
    procedure: { slug: a.procedure.slug, nameEn: a.procedure.nameEn, nameBg: a.procedure.nameBg },
    therapists: a.allocations.map((x) => ({ id: x.therapist.id, name: x.therapist.name })),
    rooms: a.allocations.map((x) => x.room.name),
    client: { name: a.guestName, email: a.guestEmail, phone: a.guestPhone },
    notes: a.notes ?? null,
    source: a.source,
    locale: a.locale,
    manageUrl: `${process.env.APP_URL ?? ""}/${a.locale}/booking/${a.code}`,
  };
}

export async function getAppointmentByCode(code: string) {
  return db.appointment.findUnique({
    where: { code },
    include: {
      procedure: true,
      variant: true,
      allocations: { include: { therapist: true, room: true }, orderBy: { roomId: "asc" } },
    },
  });
}

export type ManageAuth = { admin: true } | { userId: string } | { token: string } | { n8n: true };

export async function authorize(code: string, auth: ManageAuth) {
  const appt = await getAppointmentByCode(code);
  if (!appt) throw new BookingError("NOT_FOUND");
  if ("admin" in auth || "n8n" in auth) return appt;
  if ("userId" in auth && appt.userId === auth.userId) return appt;
  if ("token" in auth && appt.cancelTokenHash && appt.cancelTokenHash === sha256(auth.token)) return appt;
  throw new BookingError("FORBIDDEN");
}

export function canClientChange(appt: { startsAt: Date; status: string }, now = new Date()) {
  return appt.status === "BOOKED" && appt.startsAt.getTime() - now.getTime() >= CANCEL_CUTOFF_HOURS * 3_600_000;
}

export async function cancelBooking(code: string, auth: ManageAuth) {
  const appt = await authorize(code, auth);
  if (appt.status === "CANCELLED") throw new BookingError("CANCELLED");
  if (!("admin" in auth) && !canClientChange(appt)) throw new BookingError("TOO_LATE");
  return db.$transaction(async (tx) => {
    const updated = await tx.appointment.update({
      where: { id: appt.id },
      data: { status: "CANCELLED", allocations: { updateMany: { where: {}, data: { active: false } } } },
      include: { procedure: true, variant: true, allocations: { include: { therapist: true, room: true } } },
    });
    await enqueue(tx, "appointment.cancelled", appointmentPayload(updated));
    return updated;
  });
}

export async function rescheduleBooking(code: string, auth: ManageAuth, dateKey: DateKey, start: number) {
  const appt = await authorize(code, auth);
  if (appt.status !== "BOOKED") throw new BookingError("CANCELLED");
  const isAdmin = "admin" in auth;
  if (!isAdmin && !canClientChange(appt)) throw new BookingError("TOO_LATE");
  validateDate(dateKey);
  const procedure = appt.procedure;
  const ctx = await loadDayContext(dateKey, procedure.id, appt.id);
  const preferred = appt.therapistChosen ? appt.allocations[0]?.therapistId : null;
  const slot = assignAt(
    {
      durationMin: appt.variant.durationMin,
      therapistsRequired: procedure.therapistsRequired,
      therapists: ctx.therapists,
      rooms: ctx.rooms,
      preferredTherapistId: preferred,
      notBefore: isAdmin ? undefined : notBeforeFor(dateKey),
    },
    start,
  );
  if (!slot) throw new BookingError("SLOT_TAKEN");
  const startsAt = localToInstant(dateKey, slot.start);
  const endsAt = localToInstant(dateKey, slot.end);
  const blockedUntil = localToInstant(dateKey, slot.end + BUFFER_MIN);
  try {
    return await db.$transaction(async (tx) => {
      await tx.appointmentAllocation.deleteMany({ where: { appointmentId: appt.id } });
      const updated = await tx.appointment.update({
        where: { id: appt.id },
        data: {
          startsAt,
          endsAt,
          allocations: {
            create: slot.therapistIds.map((therapistId, i) => ({ therapistId, roomId: slot.roomIds[i], startsAt, blockedUntil })),
          },
        },
        include: { procedure: true, variant: true, allocations: { include: { therapist: true, room: true } } },
      });
      await enqueue(tx, "appointment.rescheduled", { ...appointmentPayload(updated), previousStartsAt: appt.startsAt.toISOString() });
      return updated;
    });
  } catch (e) {
    if (isOverlapViolation(e)) throw new BookingError("SLOT_TAKEN");
    throw e;
  }
}

export async function deleteAppointment(id: string) {
  await db.$transaction(async (tx) => {
    const appt = await tx.appointment.findUnique({
      where: { id },
      include: { procedure: true, variant: true, allocations: { include: { therapist: true, room: true } } },
    });
    if (!appt) throw new BookingError("NOT_FOUND");
    await tx.appointment.delete({ where: { id } });
    await enqueue(tx, "appointment.deleted", appointmentPayload(appt));
  });
}

export async function setAppointmentStatus(id: string, status: "BOOKED" | "COMPLETED" | "NO_SHOW") {
  await db.appointment.update({ where: { id }, data: { status } });
}

/**
 * Moves one allocation of an appointment to another therapist who is on shift,
 * qualified and free at that time (keeping time and room). Picks the least busy one
 * unless `toTherapistId` is given.
 */
export async function reassignAllocation(allocationId: string, toTherapistId?: string) {
  const alloc = await db.appointmentAllocation.findUnique({
    where: { id: allocationId },
    include: { appointment: { include: { variant: true, allocations: true } } },
  });
  if (!alloc) throw new BookingError("NOT_FOUND");
  const appt = alloc.appointment;
  const dateKey = instantToKey(appt.startsAt);
  const ctx = await loadDayContext(dateKey, appt.procedureId, appt.id);
  const taken = new Set(appt.allocations.filter((a) => a.id !== alloc.id).map((a) => a.therapistId));
  const start = instantToMinutes(appt.startsAt);
  const candidates = ctx.therapists
    .filter((t) => t.id !== alloc.therapistId && !taken.has(t.id))
    .filter((t) => !toTherapistId || t.id === toTherapistId)
    .filter((t) => therapistCanTake(t.busy, start, appt.variant.durationMin))
    .sort((a, b) => a.busy.length - b.busy.length);
  const target = candidates[0];
  if (!target) throw new BookingError("SLOT_TAKEN", "No therapist is free at that time");
  try {
    await db.appointmentAllocation.update({ where: { id: alloc.id }, data: { therapistId: target.id } });
  } catch (e) {
    if (isOverlapViolation(e)) throw new BookingError("SLOT_TAKEN");
    throw e;
  }
  return target;
}

/** Future booked appointments whose therapist is no longer on shift or is absent that day. */
export async function appointmentsNeedingAttention(from = new Date()) {
  const allocs = await db.appointmentAllocation.findMany({
    where: { active: true, startsAt: { gte: from }, appointment: { status: "BOOKED" } },
    include: { therapist: true, appointment: { include: { procedure: true } } },
    orderBy: { startsAt: "asc" },
  });
  if (!allocs.length) return [];
  const keys = [...new Set(allocs.map((a) => instantToKey(a.startsAt)))];
  const dates = keys.map(keyToUtcDate);
  const [shifts, absences] = await Promise.all([
    db.shift.findMany({ where: { date: { in: dates } } }),
    db.absence.findMany({ where: { toDate: { gte: dates[0] } } }),
  ]);
  const onShift = new Set(shifts.map((s) => `${s.therapistId}|${s.date.toISOString().slice(0, 10)}`));
  return allocs.filter((a) => {
    const k = instantToKey(a.startsAt);
    const absent = absences.some((ab) => ab.therapistId === a.therapistId && ab.fromDate.toISOString().slice(0, 10) <= k && ab.toDate.toISOString().slice(0, 10) >= k);
    return absent || a.therapist.deletedAt || !onShift.has(`${a.therapistId}|${k}`);
  });
}

export type { FullAppointment };
