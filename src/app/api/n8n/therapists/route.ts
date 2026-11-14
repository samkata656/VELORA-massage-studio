import { NextResponse } from "next/server";
import { n8nGuard } from "@/lib/n8n";
import { getBookableTherapists } from "@/lib/services/catalog";

export async function GET(req: Request) {
  const denied = n8nGuard(req);
  if (denied) return denied;
  const therapists = await getBookableTherapists();
  return NextResponse.json({
    note: "Only clients with a VELORA account may choose a therapist.",
    therapists: therapists.map((t) => ({
      id: t.id,
      name: t.name,
      titleEn: t.titleEn,
      titleBg: t.titleBg,
      procedureIds: t.skills.map((s) => s.procedureId),
    })),
  });
}
