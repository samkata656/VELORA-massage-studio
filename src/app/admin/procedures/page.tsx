import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { PageHeader, Panel } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { deleteProcedureAction, updateProcedureAction } from "../actions";
import { NewProcedureForm, VariantRow } from "./ProcedureForms";

export const metadata: Metadata = { title: "Procedures & prices" };

export default async function ProceduresPage() {
  const procedures = await db.procedure.findMany({
    where: { deletedAt: null },
    orderBy: { sort: "asc" },
    include: {
      article: { select: { id: true, source: true, updatedAt: true } },
      variants: { where: { active: true }, orderBy: { durationMin: "asc" }, include: { _count: { select: { appointments: true } } } },
    },
  });

  return (
    <>
      <PageHeader
        title="Procedures & prices"
        lead="Change lengths and prices, add or remove procedures. The benefits article of a new procedure is written automatically; removing a procedure removes its article."
      />
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          {procedures.map((p) => (
            <Panel key={p.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl leading-tight">{p.nameEn}</h2>
                  <p className="text-sm text-muted">{p.nameBg}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {p.therapistsRequired > 1 && <span className="chip">2 therapists · 2 rooms</span>}
                  {p.article ? (
                    <Link href={`/en/benefits/${p.slug}`} className="chip hover:!text-espresso">
                      Article ({p.article.source.toLowerCase()})
                    </Link>
                  ) : (
                    <span className="chip !text-warn">Article coming soon</span>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {p.variants.map((v) => (
                  <VariantRow key={v.id} procedureId={p.id} variant={{ id: v.id, durationMin: v.durationMin, price: v.priceCents / 100, bookings: v._count.appointments }} />
                ))}
                <div className="border-t border-dashed border-line pt-2">
                  <VariantRow procedureId={p.id} variant={null} />
                </div>
              </div>

              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-bronze-deep">Edit names & description</summary>
                <form action={updateProcedureAction.bind(null, p.id)} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="field">
                    <label htmlFor={`en-${p.id}`}>Name (EN)</label>
                    <input id={`en-${p.id}`} name="nameEn" defaultValue={p.nameEn} className="input" required />
                  </div>
                  <div className="field">
                    <label htmlFor={`bg-${p.id}`}>Name (BG)</label>
                    <input id={`bg-${p.id}`} name="nameBg" defaultValue={p.nameBg} className="input" required />
                  </div>
                  <div className="field">
                    <label htmlFor={`sen-${p.id}`}>Short description (EN)</label>
                    <textarea id={`sen-${p.id}`} name="summaryEn" defaultValue={p.summaryEn} className="input min-h-16" />
                  </div>
                  <div className="field">
                    <label htmlFor={`sbg-${p.id}`}>Short description (BG)</label>
                    <textarea id={`sbg-${p.id}`} name="summaryBg" defaultValue={p.summaryBg} className="input min-h-16" />
                  </div>
                  <input type="hidden" name="therapistsRequired" value={p.therapistsRequired} />
                  <div className="sm:col-span-2">
                    <button className="btn btn-primary btn-sm">Save</button>
                  </div>
                </form>
                <form action={deleteProcedureAction.bind(null, p.id)} className="mt-4 border-t border-line pt-4">
                  <ConfirmButton className="btn btn-danger btn-sm" message={`Remove “${p.nameEn}” from the menu? Past bookings stay in the history; its article will be removed.`}>
                    Remove procedure
                  </ConfirmButton>
                </form>
              </details>
            </Panel>
          ))}
        </div>

        <Panel title="Add procedure" className="xl:sticky xl:top-8 xl:self-start">
          <NewProcedureForm />
        </Panel>
      </div>
    </>
  );
}
