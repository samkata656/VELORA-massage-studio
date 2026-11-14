import { NextResponse } from "next/server";
import { n8nGuard } from "@/lib/n8n";
import { getActiveProcedures } from "@/lib/services/catalog";

export async function GET(req: Request) {
  const denied = n8nGuard(req);
  if (denied) return denied;
  const procedures = await getActiveProcedures();
  return NextResponse.json({
    currency: "EUR",
    procedures: procedures.map((p) => ({
      id: p.id,
      slug: p.slug,
      nameEn: p.nameEn,
      nameBg: p.nameBg,
      summaryEn: p.summaryEn,
      summaryBg: p.summaryBg,
      therapistsRequired: p.therapistsRequired,
      hasArticle: !!p.article,
      variants: p.variants.map((v) => ({ variantId: v.id, durationMin: v.durationMin, price: v.priceCents / 100 })),
    })),
  });
}
