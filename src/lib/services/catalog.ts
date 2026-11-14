import "server-only";
import { db } from "../db";

export async function getActiveProcedures() {
  return db.procedure.findMany({
    where: { active: true, deletedAt: null },
    orderBy: { sort: "asc" },
    include: {
      variants: { where: { active: true }, orderBy: { durationMin: "asc" } },
      article: { select: { id: true } },
    },
  });
}

export type CatalogProcedure = Awaited<ReturnType<typeof getActiveProcedures>>[number];

export async function getBookableTherapists() {
  return db.therapist.findMany({
    where: { active: true, deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: { skills: { select: { procedureId: true } } },
  });
}

export const minPrice = (p: CatalogProcedure) => Math.min(...p.variants.map((v) => v.priceCents));
