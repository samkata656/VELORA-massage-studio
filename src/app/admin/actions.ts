"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { flushOutbox, enqueue } from "@/lib/webhooks/outbox";
import {
  BookingError,
  cancelBooking,
  createBooking,
  deleteAppointment,
  getSlots,
  reassignAllocation,
  setAppointmentStatus,
} from "@/lib/services/booking";
import { rebalanceRota, toggleShift } from "@/lib/services/rota";
import { applyProposal, discardProposal, proposeChanges, sendSchedulerMessage } from "@/lib/services/scheduler-chat";
import { ScheduleChangeSchema } from "@/lib/scheduling/changes";
import type { RuleViolation } from "@/lib/scheduling/rota";

const flush = () => after(() => flushOutbox());

/* ---------------- Rota ---------------- */

export async function toggleShiftAction(therapistId: string, dateKey: string, force = false): Promise<{ ok: boolean; violations: RuleViolation[] }> {
  await requireAdmin();
  const res = await toggleShift(therapistId, dateKey, force);
  revalidatePath("/admin", "layout");
  return res;
}

export async function sendChatAction(message: string) {
  await requireAdmin();
  const text = message.trim().slice(0, 2000);
  if (!text) return;
  await sendSchedulerMessage(text);
  revalidatePath("/admin/rota");
}

export async function manualChangeAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const parsed = ScheduleChangeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  await db.schedulerMessage.create({ data: { role: "ADMIN", content: `Manual change: ${describe(parsed.data)}` } });
  await proposeChanges([parsed.data], "Preview of your manual change.");
  revalidatePath("/admin/rota");
  return { ok: true };
}

function describe(c: z.infer<typeof ScheduleChangeSchema>) {
  switch (c.type) {
    case "absence":
      return `${c.absenceType.replace("_", " ").toLowerCase()} for therapist from ${c.from} to ${c.to}`;
    case "extra_shifts":
      return `${c.count} extra shift(s)${c.from ? ` between ${c.from} and ${c.to}` : ""}`;
    case "day_off":
      return `day off on ${c.date}`;
    case "add_shift":
      return `extra shift on ${c.date}`;
  }
}

export async function applyProposalAction(id: string) {
  await requireAdmin();
  await applyProposal(id);
  flush();
  revalidatePath("/admin", "layout");
}

export async function discardProposalAction(id: string) {
  await requireAdmin();
  await discardProposal(id);
  revalidatePath("/admin/rota");
}

export async function clearChatAction() {
  await requireAdmin();
  await db.schedulerMessage.deleteMany({});
  revalidatePath("/admin/rota");
}

export async function deleteAbsenceAction(id: string) {
  await requireAdmin();
  await db.absence.delete({ where: { id } });
  revalidatePath("/admin", "layout");
}

/* ---------------- Appointments ---------------- */

export async function adminSlotsAction(variantId: string, dateKey: string, therapistId: string | null) {
  await requireAdmin();
  try {
    return { slots: await getSlots({ variantId, dateKey, preferredTherapistId: therapistId, ignoreLeadTime: true }) };
  } catch (e) {
    return { error: e instanceof BookingError ? e.code : "ERROR" };
  }
}

const AdminBooking = z.object({
  variantId: z.string().min(1),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.number().int(),
  therapistId: z.string().nullish(),
  name: z.string().trim().min(2),
  email: z.email(),
  phone: z.string().trim().min(6),
  notes: z.string().nullish(),
});

export async function adminCreateBookingAction(input: z.input<typeof AdminBooking>): Promise<{ ok: boolean; error?: string; code?: string }> {
  await requireAdmin();
  const parsed = AdminBooking.safeParse(input);
  if (!parsed.success) return { ok: false, error: `Check the field "${String(parsed.error.issues[0].path[0])}".` };
  const d = parsed.data;
  try {
    const existingUser = await db.user.findUnique({ where: { email: d.email.toLowerCase() } });
    const { appointment } = await createBooking({
      ...d,
      preferredTherapistId: d.therapistId || null,
      userId: existingUser?.id ?? null,
      source: "ADMIN",
      ignoreLeadTime: true,
    });
    flush();
    revalidatePath("/admin", "layout");
    return { ok: true, code: appointment.code };
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.code === "SLOT_TAKEN" ? "That time is no longer free." : e.message };
    throw e;
  }
}

export async function adminCancelAction(code: string) {
  await requireAdmin();
  await cancelBooking(code, { admin: true });
  flush();
  revalidatePath("/admin", "layout");
}

export async function adminDeleteAction(id: string) {
  await requireAdmin();
  await deleteAppointment(id);
  flush();
  revalidatePath("/admin", "layout");
}

export async function adminStatusAction(id: string, status: "BOOKED" | "COMPLETED" | "NO_SHOW") {
  await requireAdmin();
  await setAppointmentStatus(id, status);
  revalidatePath("/admin", "layout");
}

export async function reassignAction(allocationId: string, toTherapistId?: string): Promise<{ ok: boolean; error?: string; name?: string }> {
  await requireAdmin();
  try {
    const t = await reassignAllocation(allocationId, toTherapistId || undefined);
    revalidatePath("/admin", "layout");
    return { ok: true, name: t.name };
  } catch (e) {
    return { ok: false, error: e instanceof BookingError ? e.message : "Could not reassign" };
  }
}

/* ---------------- Therapists ---------------- */

const TherapistSchema = z.object({
  name: z.string().trim().min(2).max(80),
  titleEn: z.string().trim().max(120).default("Massage therapist"),
  titleBg: z.string().trim().max(120).default("Масажист"),
  bioEn: z.string().trim().max(500).default(""),
  bioBg: z.string().trim().max(500).default(""),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#A67C46"),
});

export async function createTherapistAction(form: FormData) {
  await requireAdmin();
  const data = TherapistSchema.parse(Object.fromEntries(form));
  const procedures = await db.procedure.findMany({ where: { deletedAt: null }, select: { id: true } });
  await db.therapist.create({ data: { ...data, skills: { create: procedures.map((p) => ({ procedureId: p.id })) } } });
  await rebalanceRota();
  flush();
  revalidatePath("/admin", "layout");
}

export async function updateTherapistAction(id: string, form: FormData) {
  await requireAdmin();
  const data = TherapistSchema.parse(Object.fromEntries(form));
  const skillIds = form.getAll("skills").map(String);
  await db.$transaction([
    db.therapist.update({ where: { id }, data }),
    db.therapistSkill.deleteMany({ where: { therapistId: id } }),
    db.therapistSkill.createMany({ data: skillIds.map((procedureId) => ({ therapistId: id, procedureId })) }),
  ]);
  revalidatePath("/admin", "layout");
}

export async function removeTherapistAction(id: string) {
  await requireAdmin();
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  await db.$transaction([
    db.therapist.update({ where: { id }, data: { active: false, deletedAt: new Date() } }),
    db.shift.deleteMany({ where: { therapistId: id, date: { gte: today } } }),
  ]);
  await rebalanceRota();
  flush();
  revalidatePath("/admin", "layout");
}

/* ---------------- Procedures ---------------- */

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

const ProcedureSchema = z.object({
  nameEn: z.string().trim().min(2).max(120),
  nameBg: z.string().trim().min(2).max(120),
  summaryEn: z.string().trim().max(300).default(""),
  summaryBg: z.string().trim().max(300).default(""),
  therapistsRequired: z.coerce.number().int().min(1).max(2).default(1),
});

function procedurePayload(p: { id: string; slug: string; nameEn: string; nameBg: string; summaryEn: string; summaryBg: string; therapistsRequired: number; variants: { durationMin: number; priceCents: number }[] }) {
  return {
    id: p.id,
    slug: p.slug,
    nameEn: p.nameEn,
    nameBg: p.nameBg,
    summaryEn: p.summaryEn,
    summaryBg: p.summaryBg,
    therapistsRequired: p.therapistsRequired,
    variants: p.variants.map((v) => ({ durationMin: v.durationMin, price: v.priceCents / 100, currency: "EUR" })),
    articleEndpoint: `${process.env.APP_URL ?? ""}/api/n8n/articles/${p.slug}`,
  };
}

export async function createProcedureAction(form: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const parsed = ProcedureSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: "Please fill in both names." };
  const durations = form.getAll("durationMin").map(Number);
  const prices = form.getAll("price").map(Number);
  const variants = durations
    .map((d, i) => ({ durationMin: d, priceCents: Math.round((prices[i] ?? 0) * 100) }))
    .filter((v) => v.durationMin >= 10 && v.durationMin <= 240 && v.priceCents > 0);
  if (!variants.length) return { ok: false, error: "Add at least one duration with a price." };
  let slug = slugify(parsed.data.nameEn) || "treatment";
  if (await db.procedure.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  const therapists = await db.therapist.findMany({ where: { deletedAt: null }, select: { id: true } });
  const maxSort = await db.procedure.aggregate({ _max: { sort: true } });
  await db.$transaction(async (tx) => {
    const p = await tx.procedure.create({
      data: {
        ...parsed.data,
        slug,
        sort: (maxSort._max.sort ?? 0) + 1,
        variants: { create: variants },
        skills: { create: therapists.map((t) => ({ therapistId: t.id })) },
      },
      include: { variants: true },
    });
    // n8n listens for this event and writes the benefits article (PUT /api/n8n/articles/:slug)
    await enqueue(tx, "procedure.created", procedurePayload(p));
  });
  flush();
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function updateProcedureAction(id: string, form: FormData) {
  await requireAdmin();
  const data = ProcedureSchema.parse(Object.fromEntries(form));
  await db.$transaction(async (tx) => {
    const p = await tx.procedure.update({ where: { id }, data, include: { variants: { where: { active: true } } } });
    await enqueue(tx, "procedure.updated", procedurePayload(p));
  });
  flush();
  revalidatePath("/admin", "layout");
}

export async function saveVariantAction(procedureId: string, variantId: string | null, form: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const durationMin = Number(form.get("durationMin"));
  const priceCents = Math.round(Number(form.get("price")) * 100);
  if (!(durationMin >= 10 && durationMin <= 240) || !(priceCents > 0)) return { ok: false, error: "Duration 10–240 min and a price above 0." };
  if (variantId) {
    const v = await db.procedureVariant.findUnique({ where: { id: variantId }, include: { _count: { select: { appointments: true } } } });
    if (!v) return { ok: false, error: "Not found" };
    if (v.durationMin !== durationMin && v._count.appointments > 0) {
      // Keep history intact: retire the old variant and create a new one with the new length.
      await db.$transaction([
        db.procedureVariant.update({ where: { id: variantId }, data: { active: false } }),
        db.procedureVariant.create({ data: { procedureId, durationMin, priceCents } }),
      ]);
    } else {
      await db.procedureVariant.update({ where: { id: variantId }, data: { durationMin, priceCents } });
    }
  } else {
    await db.procedureVariant.create({ data: { procedureId, durationMin, priceCents } });
  }
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function removeVariantAction(variantId: string) {
  await requireAdmin();
  const v = await db.procedureVariant.findUnique({ where: { id: variantId }, include: { _count: { select: { appointments: true } } } });
  if (!v) return;
  if (v._count.appointments > 0) await db.procedureVariant.update({ where: { id: variantId }, data: { active: false } });
  else await db.procedureVariant.delete({ where: { id: variantId } });
  revalidatePath("/admin", "layout");
}

export async function deleteProcedureAction(id: string) {
  await requireAdmin();
  await db.$transaction(async (tx) => {
    const p = await tx.procedure.update({
      where: { id },
      data: { active: false, deletedAt: new Date() },
      include: { variants: true },
    });
    // n8n listens for this and deletes the article (DELETE /api/n8n/articles/:slug)
    await enqueue(tx, "procedure.deleted", procedurePayload(p));
  });
  flush();
  revalidatePath("/admin", "layout");
}
