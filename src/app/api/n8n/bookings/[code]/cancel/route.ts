import { NextResponse, after } from "next/server";
import { errorResponse, n8nGuard } from "@/lib/n8n";
import { appointmentPayload, BookingError, cancelBooking, canClientChange, getAppointmentByCode } from "@/lib/services/booking";
import { flushOutbox } from "@/lib/webhooks/outbox";

/**
 * POST /api/n8n/bookings/:code/cancel  body: { email?: string, force?: boolean }
 * The 24-hour rule applies unless force=true (use only for staff-approved cancellations).
 * If email is given it must match the booking (recommended for AI chat).
 */
export async function POST(req: Request, ctx: RouteContext<"/api/n8n/bookings/[code]/cancel">) {
  const denied = n8nGuard(req);
  if (denied) return denied;
  const { code } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { email?: string; force?: boolean };
  try {
    const appt = await getAppointmentByCode(code.toUpperCase());
    if (!appt) throw new BookingError("NOT_FOUND");
    if (body.email && body.email.toLowerCase() !== appt.guestEmail) throw new BookingError("FORBIDDEN", "Email does not match the booking");
    if (!body.force && !canClientChange(appt)) throw new BookingError(appt.status === "CANCELLED" ? "CANCELLED" : "TOO_LATE");
    const updated = await cancelBooking(appt.code, { admin: true });
    after(() => flushOutbox());
    return NextResponse.json({ booking: appointmentPayload(updated) });
  } catch (e) {
    return errorResponse(e);
  }
}
