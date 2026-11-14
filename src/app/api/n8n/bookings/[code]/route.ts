import { NextResponse } from "next/server";
import { errorResponse, n8nGuard } from "@/lib/n8n";
import { appointmentPayload, BookingError, getAppointmentByCode } from "@/lib/services/booking";

export async function GET(req: Request, ctx: RouteContext<"/api/n8n/bookings/[code]">) {
  const denied = n8nGuard(req);
  if (denied) return denied;
  const { code } = await ctx.params;
  const appt = await getAppointmentByCode(code.toUpperCase());
  if (!appt) return errorResponse(new BookingError("NOT_FOUND"));
  return NextResponse.json({ booking: appointmentPayload(appt) });
}
