"use client";

import { useOptimistic, useState, useTransition } from "react";
import { toggleShiftAction } from "../actions";
import { describeViolation } from "@/lib/scheduling/describe";

export interface GridTherapist {
  id: string;
  name: string;
}

type Cell = { working: boolean; absence?: string | null };

// Two looks only: working (bronze) and not working (light). Absences are "not working" with a label.
const WORKING = "bg-bronze text-white";
const OFF = "bg-white/70 text-muted hover:bg-sand/60";
const absenceLabel: Record<string, string> = { SICK: "Sick", PAID_LEAVE: "Leave", UNPAID: "Unpaid", OTHER: "Away" };

export function RotaGrid({
  days,
  today,
  therapists,
  cells,
  coverage,
  target,
  preview,
}: {
  days: string[];
  today: string;
  therapists: GridTherapist[];
  cells: Record<string, Cell>; // key: therapistId|date
  coverage: Record<string, number>;
  target: number;
  preview: { added: string[]; removed: string[] } | null;
}) {
  const [optimistic, setOptimistic] = useOptimistic(cells, (state, key: string) => ({ ...state, [key]: { ...state[key], working: !state[key]?.working } }));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const added = new Set(preview?.added ?? []);
  const removed = new Set(preview?.removed ?? []);
  const name = (id: string) => therapists.find((t) => t.id === id)?.name ?? "Therapist";
  const fmt = (k: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { ...o, timeZone: "UTC" }).format(new Date(`${k}T00:00:00Z`));

  function toggle(therapistId: string, date: string) {
    const key = `${therapistId}|${date}`;
    setError(null);
    start(async () => {
      setOptimistic(key);
      const res = await toggleShiftAction(therapistId, date);
      if (!res.ok) setError(res.violations.map((v) => describeViolation(v, name)).join(" "));
    });
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-1 text-sm" aria-busy={pending}>
          <thead>
            <tr>
              <th className="w-44 text-left text-xs font-medium uppercase tracking-wider text-muted">Therapist</th>
              {days.map((d) => (
                <th key={d} className={`rounded-lg px-1 py-1.5 text-center font-normal ${d === today ? "bg-espresso text-linen" : "text-muted"}`}>
                  <span className="block text-[0.7rem] uppercase tracking-wider">{fmt(d, { weekday: "short" })}</span>
                  <span className="font-display text-lg leading-none">{fmt(d, { day: "numeric" })}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {therapists.map((t) => (
              <tr key={t.id}>
                <th scope="row" className="pr-2 text-left font-normal">
                  <span className="truncate">{t.name}</span>
                </th>
                {days.map((d) => {
                  const key = `${t.id}|${d}`;
                  const c = optimistic[key] ?? { working: false };
                  const past = d < today;
                  const isAdded = added.has(key);
                  const isRemoved = removed.has(key);
                  const label = c.absence ? absenceLabel[c.absence] : c.working ? "10–19" : "Off";
                  return (
                    <td key={d} className="p-0">
                      <button
                        type="button"
                        disabled={past || pending}
                        onClick={() => toggle(t.id, d)}
                        aria-label={`${t.name}, ${fmt(d, { weekday: "long", day: "numeric", month: "long" })}: ${label}. ${past ? "" : "Click to toggle shift."}`}
                        className={[
                          "relative flex h-12 w-full items-center justify-center rounded-lg text-xs transition-colors",
                          c.working ? WORKING : OFF,
                          past ? "cursor-default opacity-60" : "cursor-pointer",
                          isAdded ? "ring-2 ring-success ring-offset-1" : "",
                          isRemoved ? "ring-2 ring-danger ring-offset-1" : "",
                        ].join(" ")}
                      >
                        {c.absence && c.working ? "⚠ " : ""}
                        {label}
                        {isAdded && <span className="absolute right-1 top-0.5 text-[0.65rem] font-semibold text-success">+</span>}
                        {isRemoved && <span className="absolute right-1 top-0.5 text-[0.65rem] font-semibold text-danger">−</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <th scope="row" className="pt-2 text-left text-xs font-medium uppercase tracking-wider text-muted">
                On duty
              </th>
              {days.map((d) => {
                const n = coverage[d] ?? 0;
                return (
                  <td key={d} className="pt-2 text-center">
                    <span className={`chip tabular-nums ${n < 2 ? "!border-danger !text-danger" : n < target ? "!border-warn !text-warn" : "!text-success"}`}>
                      {n}/{target}
                    </span>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          Not changed: {error}
        </p>
      )}
      <p className="mt-3 text-xs text-muted">
        Click a day to add or remove a shift. Rules: max 5 working days in a row and 2 consecutive days off in every Mon–Sun week. Green outline = added by the pending
        proposal, red = removed.
      </p>
    </div>
  );
}
