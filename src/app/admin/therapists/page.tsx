import type { Metadata } from "next";
import { db } from "@/lib/db";
import { PageHeader, Panel } from "@/components/admin/ui";
import { createTherapistAction, removeTherapistAction, updateTherapistAction } from "../actions";
import { ConfirmButton } from "@/components/admin/ConfirmButton";

export const metadata: Metadata = { title: "Therapists" };

export default async function TherapistsPage() {
  const now = new Date();
  const [therapists, procedures] = await Promise.all([
    db.therapist.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: {
        skills: true,
        _count: { select: { allocations: { where: { active: true, startsAt: { gte: now }, appointment: { status: "BOOKED" } } } } },
      },
    }),
    db.procedure.findMany({ where: { deletedAt: null }, orderBy: { sort: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Therapists" lead={`${therapists.length} active. Adding or removing a therapist re-balances the next 8 weeks of the rota automatically.`} />

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          {therapists.map((t) => {
            const skillSet = new Set(t.skills.map((s) => s.procedureId));
            return (
              <Panel key={t.id}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-3">
                      <span className="h-9 w-9 rounded-full" style={{ background: t.color }} aria-hidden="true" />
                      <span>
                        <span className="block font-display text-2xl leading-tight">{t.name}</span>
                        <span className="text-sm text-muted">{t.titleEn}</span>
                      </span>
                    </span>
                    <span className="flex items-center gap-3 text-sm text-muted">
                      {t._count.allocations} upcoming bookings · {skillSet.size}/{procedures.length} procedures
                      <span className="chip group-open:hidden">Edit</span>
                    </span>
                  </summary>

                  <form action={updateTherapistAction.bind(null, t.id)} className="mt-5 grid gap-4 border-t border-line pt-5 md:grid-cols-2">
                    <TherapistFields t={t} />
                    <fieldset className="md:col-span-2">
                      <legend className="label mb-2">Performs</legend>
                      <div className="flex flex-wrap gap-2">
                        {procedures.map((p) => (
                          <label key={p.id} className="choice inline-flex items-center gap-2 px-3 py-1.5 text-sm">
                            <input type="checkbox" name="skills" value={p.id} defaultChecked={skillSet.has(p.id)} className="sr-only" />
                            {p.nameEn}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div className="flex flex-wrap gap-2 md:col-span-2">
                      <button className="btn btn-primary btn-sm">Save</button>
                    </div>
                  </form>
                  <form action={removeTherapistAction.bind(null, t.id)} className="mt-3">
                    <ConfirmButton
                      className="btn btn-danger btn-sm"
                      message={`Remove ${t.name}? Their future shifts are deleted and the rota is re-balanced.${t._count.allocations ? ` ${t._count.allocations} upcoming booking(s) will need reassignment (shown on the dashboard).` : ""}`}
                    >
                      Remove therapist
                    </ConfirmButton>
                  </form>
                </details>
              </Panel>
            );
          })}
        </div>

        <Panel title="Add therapist" className="xl:sticky xl:top-8 xl:self-start">
          <form action={createTherapistAction} className="grid gap-4">
            <TherapistFields />
            <p className="text-xs text-muted">New therapists can perform all procedures; adjust after saving.</p>
            <button className="btn btn-primary">Add therapist</button>
          </form>
        </Panel>
      </div>
    </>
  );
}

function TherapistFields({ t }: { t?: { name: string; titleEn: string; titleBg: string; bioEn: string; bioBg: string; color: string } }) {
  const id = t?.name.replace(/\W/g, "") ?? "new";
  return (
    <>
      <div className="field">
        <label htmlFor={`${id}-name`}>Name</label>
        <input id={`${id}-name`} name="name" className="input" required minLength={2} defaultValue={t?.name} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-color`}>Calendar colour</label>
        <input id={`${id}-color`} name="color" type="color" className="input !p-1" defaultValue={t?.color ?? "#A67C46"} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-ten`}>Title (EN)</label>
        <input id={`${id}-ten`} name="titleEn" className="input" defaultValue={t?.titleEn ?? "Massage therapist"} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-tbg`}>Title (BG)</label>
        <input id={`${id}-tbg`} name="titleBg" className="input" defaultValue={t?.titleBg ?? "Масажист"} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-ben`}>Bio (EN)</label>
        <textarea id={`${id}-ben`} name="bioEn" className="input min-h-20" defaultValue={t?.bioEn} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-bbg`}>Bio (BG)</label>
        <textarea id={`${id}-bbg`} name="bioBg" className="input min-h-20" defaultValue={t?.bioBg} />
      </div>
    </>
  );
}
