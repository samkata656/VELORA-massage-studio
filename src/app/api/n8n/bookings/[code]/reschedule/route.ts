import { NextResponse, after } from "next/server";
import { z } from "zod";
import { errorResponse, n8nGuard } from "@/lib/n8n";
import { appointmentPayload, BookingError, canClientChange, getAppointmentByCode, rescheduleBooking } from "@/lib/services/booking";
import { flushOutbox } from "@/lib/webhooks/outbox";
import { parseHHMM } from "@/lib/time";

const Body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  email: z.email().optional(),
});

/** POST /api/n8n/bookings/:code/reschedule  body: { date, time, email? } */
export async function POST(req: Request, ctx: RouteContext<"/api/n8n/bookings/[code]/reschedule">) {
  const denied = n8nGuard(req);
  if (denied) return denied;
  const { code } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID", issues: parsed.error.issues }, { status: 400 });
  try {
    const appt = await getAppointmentByCode(code.toUpperCase());
    if (!appt) throw new BookingError("NOT_FOUND");
    if (parsed.data.email && parsed.data.email.toLowerCase() !== appt.guestEmail) throw new BookingError("FORBIDDEN", "Email does not match the booking");
    if (!canClientChange(appt)) throw new BookingError(appt.status === "BOOKED" ? "TOO_LATE" : "CANCELLED");
    const updated = await rescheduleBooking(appt.code, { n8n: true }, parsed.data.date, parseHHMM(parsed.data.time));
    after(() => flushOutbox());
    return NextResponse.json({ booking: appointmentPayload(updated) });
  } catch (e) {
    return errorResponse(e);
  }
}
