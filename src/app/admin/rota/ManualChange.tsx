"use client";

import { useState, useTransition } from "react";
import { manualChangeAction } from "../actions";

type Kind = "absence" | "extra_shifts" | "day_off" | "add_shift";

export function ManualChange({ therapists, today }: { therapists: { id: string; name: string }[]; today: string }) {
  const [kind, setKind] = useState<Kind>("absence");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const therapist = String(f.get("therapist"));
        const change =
          kind === "absence"
            ? { type: kind, therapist, from: f.get("from"), to: f.get("to") || f.get("from"), absenceType: f.get("absenceType"), note: f.get("note") || undefined }
            : kind === "extra_shifts"
              ? { type: kind, therapist, count: Number(f.get("count")), from: f.get("from") || undefined, to: f.get("to") || undefined }
              : { type: kind, therapist, date: f.get("from") };
        setError(null);
        start(async () => {
          const r = await manualChangeAction(change);
          if (!r.ok) setError(r.error ?? "Invalid change");
        });
      }}
    >
      <div className="field">
        <label htmlFor="mc-kind">Change</label>
        <select id="mc-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
          <option value="absence">Absence (sick / leave)</option>
          <option value="extra_shifts">Extra shifts</option>
          <option value="day_off">Day off on a date</option>
          <option value="add_shift">Extra shift on a date</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="mc-therapist">Therapist</label>
        <select id="mc-therapist" name="therapist" className="input" required>
          {therapists.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      {kind === "absence" && (
        <div className="field">
          <label htmlFor="mc-type">Type</label>
          <select id="mc-type" name="absenceType" className="input">
            <option value="SICK">Sick leave</option>
            <option value="PAID_LEAVE">Paid leave</option>
            <option value="UNPAID">Unpaid leave</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      )}
      {kind === "extra_shifts" && (
        <div className="field">
          <label htmlFor="mc-count">How many</label>
          <input id="mc-count" name="count" type="number" min={1} max={10} defaultValue={1} className="input" />
        </div>
      )}
      <div className="field">
        <label htmlFor="mc-from">{kind === "absence" || kind === "extra_shifts" ? "From" : "Date"}</label>
        <input id="mc-from" name="from" type="date" min={today} className="input" required={kind !== "extra_shifts"} />
      </div>
      {(kind === "absence" || kind === "extra_shifts") && (
        <div className="field">
          <label htmlFor="mc-to">To (inclusive)</label>
          <input id="mc-to" name="to" type="date" min={today} className="input" />
        </div>
      )}
      {kind === "absence" && (
        <div className="field sm:col-span-2">
          <label htmlFor="mc-note">Note (optional)</label>
          <input id="mc-note" name="note" className="input" maxLength={300} />
        </div>
      )}
      {error && <p className="error-text sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <button className="btn btn-primary btn-sm" disabled={pending}>
          Preview change
        </button>
      </div>
    </form>
  );
}
