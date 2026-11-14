import "server-only";
import { NextResponse } from "next/server";
import { safeEqual } from "./crypto";
import { BookingError } from "./services/booking";

/** Short or placeholder keys are treated as "not configured" so a guessable key can never open the API. */
export const MIN_API_KEY_LENGTH = 32;

/** Checks "Authorization: Bearer <N8N_API_KEY>". Returns a 401 response when invalid, 503 when no usable key is set. */
export function n8nGuard(req: Request): NextResponse | null {
  const key = process.env.N8N_API_KEY ?? "";
  if (key.length < MIN_API_KEY_LENGTH) {
    return NextResponse.json({ error: "not_configured", message: `Set N8N_API_KEY (at least ${MIN_API_KEY_LENGTH} characters) to enable the n8n API` }, { status: 503 });
  }
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!key || !token || !safeEqual(token, key)) {
    return NextResponse.json({ error: "unauthorized", message: "Send Authorization: Bearer <N8N_API_KEY>" }, { status: 401 });
  }
  return null;
}

const statusFor: Record<string, number> = { SLOT_TAKEN: 409, NOT_FOUND: 404, TOO_LATE: 422, INVALID: 400, FORBIDDEN: 403, CANCELLED: 409 };
const messages: Record<string, string> = {
  SLOT_TAKEN: "That time is not available. Fetch /api/n8n/availability again and offer another time.",
  NOT_FOUND: "Booking not found.",
  TOO_LATE: "Less than 24 hours before the appointment — the client must call the studio.",
  INVALID: "Invalid request.",
  FORBIDDEN: "Not allowed.",
  CANCELLED: "This booking is already cancelled.",
};

export function errorResponse(e: unknown) {
  if (e instanceof BookingError) {
    return NextResponse.json({ error: e.code, message: messages[e.code] ?? e.message, detail: e.message !== e.code ? e.message : undefined }, { status: statusFor[e.code] ?? 400 });
  }
  console.error(e);
  return NextResponse.json({ error: "server_error", message: "Unexpected error" }, { status: 500 });
}
