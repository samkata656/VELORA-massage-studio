"use server";

import { after } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { BookingError, createBooking, getSlots, rescheduleBooking, cancelBooking, type SlotView } from "@/lib/services/booking";
import { flushOutbox } from "@/lib/webhooks/outbox";
import { isLocale } from "@/i18n/config";

export type SlotsResult = { slots: SlotView[] } | { error: string };

export async function fetchSlotsAction(input: {
  variantId: string;
  dateKey: string;
  therapistId?: string | null;
  rescheduleCode?: string;
}): Promise<SlotsResult> {
  try {
    const user = await getCurrentUser();
    // Choosing a therapist is a perk for registered clients only.
    const preferred = user ? input.therapistId || null : null;
    let excludeAppointmentId: string | undefined;
    if (input.rescheduleCode) {
      const { db } = await import("@/lib/db");
      excludeAppointmentId = (await db.appointment.findUnique({ where: { code: input.rescheduleCode }, select: { id: true } }))?.id;
    }
    return { slots: await getSlots({ variantId: input.variantId, dateKey: input.dateKey, preferredTherapistId: preferred, excludeAppointmentId }) };
  } catch (e) {
    return { error: e instanceof BookingError ? e.code : "ERROR" };
  }
}

const BookingSchema = z.object({
  variantId: z.string().min(1),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.number().int().min(0).max(24 * 60),
  therapistId: z.string().nullish(),
  name: z.string().trim().min(2).max(120),
  email: z.email().max(200),
  phone: z.string().trim().regex(/^\+?[0-9\s\-()]{7,20}$/),
  notes: z.string().max(1000).nullish(),
  locale: z.string(),
});

export type BookingResult =
  | { ok: true; code: string; token: string }
  | { ok: false; error: "SLOT_TAKEN" | "VALIDATION" | "ERROR"; field?: string };

export async function submitBookingAction(input: z.input<typeof BookingSchema>): Promise<BookingResult> {
  const parsed = BookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION", field: String(parsed.error.issues[0].path[0]) };
  const d = parsed.data;
  const user = await getCurrentUser();
  try {
    const { appointment, cancelToken } = await createBooking({
      variantId: d.variantId,
      dateKey: d.dateKey,
      start: d.start,
      preferredTherapistId: user ? d.therapistId : null,
      userId: user?.id ?? null,
      name: d.name,
      email: d.email,
      phone: d.phone,
      notes: d.notes,
      source: "WEB",
      locale: isLocale(d.locale) ? d.locale : "bg",
    });
    after(() => flushOutbox());
    return { ok: true, code: appointment.code, token: cancelToken };
  } catch (e) {
    if (e instanceof BookingError && e.code === "SLOT_TAKEN") return { ok: false, error: "SLOT_TAKEN" };
    if (e instanceof BookingError) return { ok: false, error: "VALIDATION" };
    console.error(e);
    return { ok: false, error: "ERROR" };
  }
}

async function manageAuth(token?: string) {
  const user = await getCurrentUser();
  if (user?.role === "ADMIN") return { admin: true } as const;
  if (token) return { token };
  if (user) return { userId: user.id };
  throw new BookingError("FORBIDDEN");
}

export async function cancelBookingAction(code: string, token?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await cancelBooking(code, await manageAuth(token));
    after(() => flushOutbox());
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof BookingError ? e.code : "ERROR" };
  }
}

export async function rescheduleBookingAction(code: string, token: string | undefined, dateKey: string, start: number): Promise<{ ok: boolean; error?: string }> {
  try {
    await rescheduleBooking(code, await manageAuth(token), dateKey, start);
    after(() => flushOutbox());
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof BookingError ? e.code : "ERROR" };
  }
}
