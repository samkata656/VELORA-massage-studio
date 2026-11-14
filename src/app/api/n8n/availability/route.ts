import { NextResponse } from "next/server";
import { errorResponse, n8nGuard } from "@/lib/n8n";
import { getSlots } from "@/lib/services/booking";

/** GET /api/n8n/availability?variantId=…&date=YYYY-MM-DD[&therapistId=…] */
export async function GET(req: Request) {
  const denied = n8nGuard(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const variantId = url.searchParams.get("variantId");
  const date = url.searchParams.get("date");
  if (!variantId || !date) return NextResponse.json({ error: "INVALID", message: "variantId and date are required" }, { status: 400 });
  try {
    const slots = await getSlots({ variantId, dateKey: date, preferredTherapistId: url.searchParams.get("therapistId") });
    return NextResponse.json({ date, timezone: "Europe/Sofia", times: slots.map((s) => s.label) });
  } catch (e) {
    return errorResponse(e);
  }
}
