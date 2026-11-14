"use client";

import { useState, useTransition } from "react";
import { TimeGrid } from "@/components/SlotPicker";
import { adminCreateBookingAction, adminSlotsAction } from "../actions";

interface Proc {
  id: string;
  name: string;
  therapistsRequired: number;
  variants: { id: string; durationMin: number; price: string }[];
}

export function AdminBookingForm({ procedures, therapists, initialDate }: { procedures: Proc[]; therapists: { id: string; name: string }[]; initialDate: string }) {
  const [procedureId, setProcedureId] = useState(procedures[0]?.id ?? "");
  const proc = procedures.find((p) => p.id === procedureId);
  const [variantId, setVariantId] = useState(proc?.variants[0]?.id ?? "");
  const [date, setDate] = useState(initialDate);
  const [therapistId, setTherapistId] = useState("");
  const [start, setStart] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startT] = useTransition();
  const [nonce, setNonce] = useState(0);

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (start === null) return;
        const f = new FormData(e.currentTarget);
        startT(async () => {
          const r = await adminCreateBookingAction({
            variantId,
            dateKey: date,
            start,
            therapistId: therapistId || null,
            name: String(f.get("name")),
            email: String(f.get("email")),
            phone: String(f.get("phone")),
            notes: String(f.get("notes") || "") || null,
          });
          setMsg(r.ok ? { ok: true, text: `Booked — code ${r.code}` } : { ok: false, text: r.error ?? "Failed" });
          if (r.ok) {
            (e.target as HTMLFormElement).reset();
            setStart(null);
            setNonce((n) => n + 1);
          }
        });
      }}
    >
      <div className="grid gap-4 md:grid-cols-4">
        <div className="field md:col-span-2">
          <label htmlFor="ab-proc">Procedure</label>
          <select
            id="ab-proc"
            className="input"
            value={procedureId}
            onChange={(e) => {
              setProcedureId(e.target.value);
              setVariantId(procedures.find((p) => p.id === e.target.value)?.variants[0]?.id ?? "");
            }}
          >
            {procedures.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ab-var">Duration</label>
          <select id="ab-var" className="input" value={variantId} onChange={(e) => setVariantId(e.target.value)}>
            {proc?.variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.durationMin} min · {v.price}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ab-date">Date</label>
          <input id="ab-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="field md:col-span-2">
          <label htmlFor="ab-th">Therapist {proc && proc.therapistsRequired > 1 && "(first of two)"}</label>
          <select id="ab-th" className="input" value={therapistId} onChange={(e) => setTherapistId(e.target.value)}>
            <option value="">Any available</option>
            {therapists.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {variantId && (
        <TimeGrid
          deps={[variantId, date, therapistId, nonce]}
          load={async () => {
            const r = await adminSlotsAction(variantId, date, therapistId || null);
            return "slots" in r ? r.slots! : { error: r.error ?? "ERROR" };
          }}
          value={start}
          onChange={setStart}
          label="Free start times"
          emptyText="No free times for this combination."
          loadingText="Loading…"
        />
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="field">
          <label htmlFor="ab-name">Client name</label>
          <input id="ab-name" name="name" className="input" required minLength={2} />
        </div>
        <div className="field">
          <label htmlFor="ab-phone">Phone</label>
          <input id="ab-phone" name="phone" type="tel" className="input" required />
        </div>
        <div className="field">
          <label htmlFor="ab-email">Email</label>
          <input id="ab-email" name="email" type="email" className="input" required />
        </div>
        <div className="field md:col-span-3">
          <label htmlFor="ab-notes">Notes</label>
          <input id="ab-notes" name="notes" className="input" />
        </div>
      </div>
      {msg && <p className={`rounded-xl px-4 py-2.5 text-sm ${msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>{msg.text}</p>}
      <button className="btn btn-primary" disabled={pending || start === null}>
        Create appointment
      </button>
    </form>
  );
}
