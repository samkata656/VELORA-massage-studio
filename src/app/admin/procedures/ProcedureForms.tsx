"use client";

import { useState, useTransition } from "react";
import { createProcedureAction, removeVariantAction, saveVariantAction } from "../actions";

export function VariantRow({ procedureId, variant }: { procedureId: string; variant: { id: string; durationMin: number; price: number; bookings: number } | null }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const form = e.currentTarget;
        setMsg(null);
        start(async () => {
          const r = await saveVariantAction(procedureId, variant?.id ?? null, f);
          if (!r.ok) setMsg(r.error ?? "Failed");
          else {
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
            if (!variant) form.reset();
          }
        });
      }}
    >
      <div className="field w-28">
        <label htmlFor={`d-${variant?.id ?? procedureId}`} className="!text-xs">
          Minutes
        </label>
        <input id={`d-${variant?.id ?? procedureId}`} name="durationMin" type="number" min={10} max={240} step={5} defaultValue={variant?.durationMin} className="input !min-h-9 !py-1" required />
      </div>
      <div className="field w-28">
        <label htmlFor={`p-${variant?.id ?? procedureId}`} className="!text-xs">
          Price €
        </label>
        <input id={`p-${variant?.id ?? procedureId}`} name="price" type="number" min={1} step={0.5} defaultValue={variant?.price} className="input !min-h-9 !py-1" required />
      </div>
      <button className="btn btn-ghost btn-sm" disabled={pending}>
        {variant ? (saved ? "Saved ✓" : "Save") : "Add duration"}
      </button>
      {variant && (
        <button
          type="button"
          className="btn btn-danger btn-sm"
          disabled={pending}
          onClick={() => confirm(`Remove the ${variant.durationMin}-minute option?`) && start(() => removeVariantAction(variant.id))}
        >
          Remove
        </button>
      )}
      {variant && variant.bookings > 0 && <span className="pb-2 text-xs text-muted">{variant.bookings} bookings use it — changing minutes keeps history intact</span>}
      {msg && <span className="error-text pb-2">{msg}</span>}
    </form>
  );
}

export function NewProcedureForm() {
  const [rows, setRows] = useState(1);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        start(async () => {
          const r = await createProcedureAction(f);
          setMsg(r.ok ? { ok: true, text: "Procedure added. Its benefits article will be written automatically." } : { ok: false, text: r.error ?? "Failed" });
          if (r.ok) {
            form.reset();
            setRows(1);
          }
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field">
          <label htmlFor="np-en">Name (EN)</label>
          <input id="np-en" name="nameEn" className="input" required minLength={2} />
        </div>
        <div className="field">
          <label htmlFor="np-bg">Name (BG)</label>
          <input id="np-bg" name="nameBg" className="input" required minLength={2} />
        </div>
        <div className="field">
          <label htmlFor="np-sen">Short description (EN)</label>
          <textarea id="np-sen" name="summaryEn" className="input min-h-16" maxLength={300} />
        </div>
        <div className="field">
          <label htmlFor="np-sbg">Short description (BG)</label>
          <textarea id="np-sbg" name="summaryBg" className="input min-h-16" maxLength={300} />
        </div>
        <div className="field">
          <label htmlFor="np-tr">Therapists needed</label>
          <select id="np-tr" name="therapistsRequired" className="input">
            <option value="1">1 (one room)</option>
            <option value="2">2 (two rooms, e.g. couples)</option>
          </select>
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className="label mb-1">Durations & prices</legend>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex gap-2">
            <label className="sr-only" htmlFor={`np-d${i}`}>
              Minutes
            </label>
            <input id={`np-d${i}`} name="durationMin" type="number" min={10} max={240} step={5} placeholder="Minutes" className="input !w-32" required={i === 0} />
            <label className="sr-only" htmlFor={`np-p${i}`}>
              Price in euro
            </label>
            <input id={`np-p${i}`} name="price" type="number" min={1} step={0.5} placeholder="Price €" className="input !w-32" required={i === 0} />
          </div>
        ))}
        <button type="button" className="text-sm text-bronze-deep hover:underline" onClick={() => setRows((r) => Math.min(r + 1, 5))}>
          + another duration
        </button>
      </fieldset>
      {msg && <p className={`rounded-xl px-4 py-2.5 text-sm ${msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>{msg.text}</p>}
      <button className="btn btn-primary" disabled={pending}>
        Add procedure
      </button>
    </form>
  );
}
