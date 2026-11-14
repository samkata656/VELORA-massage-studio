import { NextResponse, after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { errorResponse, n8nGuard } from "@/lib/n8n";
import { appointmentPayload, BookingError, createBooking } from "@/lib/services/booking";
import { flushOutbox } from "@/lib/webhooks/outbox";
import { addDays, localToInstant, parseHHMM } from "@/lib/time";

const include = { procedure: true, variant: true, allocations: { include: { therapist: true, room: true } } } as const;

/** GET /api/n8n/bookings?date=YYYY-MM-DD  or  ?email=client@example.com */
export async function GET(req: Request) {
  const denied = n8nGuard(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const email = url.searchParams.get("email")?.toLowerCase();
  if (!date && !email) return NextResponse.json({ error: "INVALID", message: "Pass date or email" }, { status: 400 });
  const appointments = await db.appointment.findMany({
    where: {
      ...(date ? { startsAt: { gte: localToInstant(date, 0), lt: localToInstant(addDays(date, 1), 0) } } : {}),
      ...(email ? { guestEmail: email } : {}),
    },
    include,
    orderBy: { startsAt: "asc" },
    take: 200,
  });
  return NextResponse.json({ bookings: appointments.map(appointmentPayload) });
}

const CreateSchema = z
  .object({
    variantId: z.string().optional(),
    procedureSlug: z.string().optional(),
    durationMin: z.number().int().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    therapistId: z.string().nullish(),
    name: z.string().trim().min(2),
    email: z.email(),
    phone: z.string().trim().min(6),
    notes: z.string().max(1000).nullish(),
    locale: z.enum(["bg", "en"]).default("bg"),
  })
  .refine((d) => d.variantId || (d.procedureSlug && d.durationMin), { message: "Pass variantId, or procedureSlug + durationMin" });

/** POST /api/n8n/bookings — creates a booking from the AI chat. */
export async function POST(req: Request) {
  const denied = n8nGuard(req);
  if (denied) return denied;
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID", issues: parsed.error.issues }, { status: 400 });
  const d = parsed.data;
  try {
    let variantId = d.variantId;
    if (!variantId) {
      const v = await db.procedureVariant.findFirst({
        where: { durationMin: d.durationMin, active: true, procedure: { slug: d.procedureSlug, active: true, deletedAt: null } },
      });
      if (!v) throw new BookingError("INVALID", "Unknown procedure/duration");
      variantId = v.id;
    }
    // Choosing a therapist is reserved for registered clients (matched by email).
    const user = await db.user.findUnique({ where: { email: d.email.toLowerCase() } });
    const therapistId = user ? d.therapistId : null;
    const { appointment, cancelToken } = await createBooking({
      variantId,
      dateKey: d.date,
      start: parseHHMM(d.time),
      preferredTherapistId: therapistId,
      userId: user?.id ?? null,
      name: d.name,
      email: d.email,
      phone: d.phone,
      notes: d.notes,
      source: "AI",
      locale: d.locale,
    });
    after(() => flushOutbox());
    const payload = appointmentPayload(appointment);
    return NextResponse.json(
      {
        booking: { ...payload, manageUrl: `${payload.manageUrl}?t=${cancelToken}` },
        therapistPreferenceIgnored: !!d.therapistId && !user,
      },
      { status: 201 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
